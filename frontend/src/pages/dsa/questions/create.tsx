'use client'

import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/dsa/ui/card'
import { Button } from '../../../components/dsa/ui/button'
import { Input } from '../../../components/dsa/ui/input'
import { Textarea } from '../../../components/dsa/ui/textarea'
import { Checkbox } from '../../../components/dsa/ui/checkbox'
import dsaApi from '../../../lib/dsa/api'
import { Sparkles, Loader2, Code, Database, Table2 } from 'lucide-react'

// Question type - Coding or SQL
type QuestionType = 'coding' | 'sql'

type Testcase = {
  input: string | any  // Can be string or object (object will be formatted for display)
  expected_output?: string  // Optional for AI-generated questions
}

const getExpectedOutputPlaceholder = (returnType: string) => {
  const rt = (returnType || '').trim()
  switch (rt) {
    case 'int':
    case 'long':
      return 'e.g., 5'
    case 'int[]':
    case 'long[]':
      return 'e.g., 0 1'
    case 'boolean':
      return 'e.g., true'
    case 'string':
      return 'e.g., hello'
    default:
      return 'e.g., 5'
  }
}

const getStdinPlaceholder = () => {
  return 'Raw stdin only (no variable names, no JSON arrays like [1,2,3])'
}

// Helper function to safely convert input to string for display
const formatTestcaseInput = (input: any): string => {
  if (input === null || input === undefined) {
    return ''
  }
  if (typeof input === 'string') {
    return input
  }
  if (typeof input === 'object') {
    // Convert object to JSON string with proper formatting
    try {
      return JSON.stringify(input, null, 2)
    } catch (e) {
      return String(input)
    }
  }
  return String(input)
}

// Helper function to safely convert expected_output to string for display
const formatTestcaseExpectedOutput = (output: any): string => {
  if (output === null || output === undefined) {
    return ''
  }
  if (typeof output === 'string') {
    return output
  }
  if (typeof output === 'object') {
    try {
      return JSON.stringify(output, null, 2)
    } catch (e) {
      return String(output)
    }
  }
  return String(output)
}

// Helper function to parse testcase input back to object if it's valid JSON, otherwise keep as string
const parseTestcaseInput = (input: string): any => {
  if (!input || !input.trim()) {
    return input
  }
  // Try to parse as JSON object
  try {
    const parsed = JSON.parse(input.trim())
    // If it's an object, return it; otherwise return the original string
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed
    }
    // If it's an array or primitive, return original string (legacy format)
    return input
  } catch (e) {
    // Not valid JSON, return as string (legacy stdin format)
    return input
  }
}

// Helper to parse expected_output into JSON value when possible
const parseTestcaseExpectedOutput = (output: any): any => {
  // If it's already a non-string value (e.g., object/array/number/boolean from AI),
  // just return it as-is.
  if (output !== null && output !== undefined && typeof output !== 'string') {
    return output
  }

  const str = (output || '').toString()
  if (!str.trim()) {
    return ''
  }

  try {
    const parsed = JSON.parse(str.trim())
    return parsed
  } catch (e) {
    // Not valid JSON, keep as string
    return str
  }
}

// Helper function to safely check if testcase input is non-empty (handles both string and object)
const isTestcaseInputNonEmpty = (input: any): boolean => {
  if (!input) {
    return false
  }
  if (typeof input === 'string') {
    return input.trim().length > 0
  }
  if (typeof input === 'object') {
    // For objects, check if it has any properties
    return Object.keys(input).length > 0
  }
  return false
}

// DSA (Data Structures & Algorithms) supported languages
// These are commonly used languages for competitive programming and DSA
const SUPPORTED_LANGUAGES = [
  'python',      // Python - most popular for DSA
  'javascript',  // JavaScript - web-based DSA
  'cpp',         // C++ - standard for competitive programming
  'java',        // Java - widely used for DSA
  'c',           // C - fundamental language for DSA
  'go',          // Go - growing in popularity
  'rust',        // Rust - modern systems language
  'csharp',      // C# - used in some DSA contexts
  'kotlin',      // Kotlin - Android development, DSA
  'typescript',  // TypeScript - JavaScript with types
]

const DEFAULT_STARTER_CODE: Record<string, string> = {
  python: `def solution():
    # Your code here
    pass
`,
  javascript: `function solution() {
    // Your code here
}
`,
  typescript: `function solution(): void {
    // Your code here
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Your code here
    return 0;
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        // Your code here
    }
}
`,
  c: `#include <stdio.h>

int main() {
    // Your code here
    return 0;
}
`,
  go: `package main

import "fmt"

func main() {
    // Your code here
}
`,
  rust: `fn main() {
    // Your code here
}
`,
  csharp: `using System;

class Program {
    static void Main(string[] args) {
        // Your code here
    }
}
`,
  kotlin: `fun main() {
    // Your code here
}
`,
}

// SQL Categories
const SQL_CATEGORIES = [
  { value: 'select', label: 'SELECT Queries', description: 'Basic data retrieval' },
  { value: 'join', label: 'JOIN Operations', description: 'INNER, LEFT, RIGHT, FULL joins' },
  { value: 'aggregation', label: 'Aggregation', description: 'GROUP BY, HAVING, COUNT, SUM' },
  { value: 'subquery', label: 'Subqueries', description: 'Nested queries, EXISTS, IN' },
  { value: 'window', label: 'Window Functions', description: 'ROW_NUMBER, RANK, LAG, LEAD' },
]

// SQL Topics for quick selection
const SQL_TOPICS = [
  'Basic SELECT', 'Filtering with WHERE', 'INNER JOIN', 'LEFT JOIN',
  'GROUP BY', 'HAVING Clause', 'Aggregate Functions', 'Subqueries', 'Window Functions'
]

type TableSchema = {
  columns: Record<string, string>
}

export default function QuestionCreatePage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Question Type selector
  const [questionType, setQuestionType] = useState<QuestionType>('coding')
  
  // AI Generation fields
  const [aiTopic, setAiTopic] = useState('')
  const [aiConcepts, setAiConcepts] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('medium')

  const [title, setTitle] = useState('')
  // LeetCode-style 3-part description
  const [description, setDescription] = useState('Describe the problem here. What needs to be solved? What is the task?')
  const [examples, setExamples] = useState<Array<{input: string, output: string, explanation: string}>>([
    { input: '', output: '', explanation: '' }
  ])
  const [constraints, setConstraints] = useState<string[]>([''])
  
  const [difficulty, setDifficulty] = useState('medium')
  const [languages, setLanguages] = useState<string[]>(['python'])
  const [isPublished, setIsPublished] = useState(false)
  const [starterCode, setStarterCode] = useState<Record<string, string>>({
    python: DEFAULT_STARTER_CODE.python,
    javascript: DEFAULT_STARTER_CODE.javascript,
    cpp: DEFAULT_STARTER_CODE.cpp,
    java: DEFAULT_STARTER_CODE.java,
  })
  const [publicTestcases, setPublicTestcases] = useState<Testcase[]>([
    { input: '', expected_output: '' }
  ])
  const [hiddenTestcases, setHiddenTestcases] = useState<Testcase[]>([
    { input: '', expected_output: '' }
  ])
  
  // Secure Mode settings (blocks I/O code, wraps user function)
  const [secureMode, setSecureMode] = useState(false)
  const [functionName, setFunctionName] = useState('')
  const [returnType, setReturnType] = useState('int')
  const [parameters, setParameters] = useState<Array<{name: string, type: string}>>([
    { name: '', type: 'int' }
  ])
  const [isAiGenerated, setIsAiGenerated] = useState(false)

  // SQL-specific state
  const [sqlCategory, setSqlCategory] = useState('select')
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({})
  const [sampleData, setSampleData] = useState<Record<string, any[][]>>({})
  const [starterQuery, setStarterQuery] = useState('-- Write your SQL query here\n\nSELECT ')
  const [referenceQuery, setReferenceQuery] = useState('')  // Correct SQL answer for evaluation
  const [hints, setHints] = useState<string[]>([''])
  const [orderSensitive, setOrderSensitive] = useState(false)

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    )
  }

  const updateTestcase = (
    idx: number,
    type: 'public' | 'hidden',
    field: keyof Testcase,
    value: string
  ) => {
    if (type === 'public') {
      setPublicTestcases((prev) => {
        const copy = [...prev]
        // Ensure input is always stored as string
        if (field === 'input') {
          copy[idx] = { ...copy[idx], [field]: value }
        } else {
          copy[idx] = { ...copy[idx], [field]: value }
        }
        return copy
      })
    } else {
      setHiddenTestcases((prev) => {
        const copy = [...prev]
        // Ensure input is always stored as string
        if (field === 'input') {
          copy[idx] = { ...copy[idx], [field]: value }
        } else {
          copy[idx] = { ...copy[idx], [field]: value }
        }
        return copy
      })
    }
  }

  const addTestcase = (type: 'public' | 'hidden') => {
    if (type === 'public') {
      setPublicTestcases((prev) => [...prev, { input: '', expected_output: '' }])
    } else {
      setHiddenTestcases((prev) => [...prev, { input: '', expected_output: '' }])
    }
  }

  const removeTestcase = (type: 'public' | 'hidden', idx: number) => {
    if (type === 'public') {
      setPublicTestcases((prev) =>
        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
      )
    } else {
      setHiddenTestcases((prev) =>
        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
      )
    }
  }

  // AI Generation handler - handles both Coding and SQL
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim() && !aiConcepts.trim()) {
      setError('Please provide a topic or concepts for AI generation')
      return
    }

    // For coding questions, ensure at least one language is selected
    if (questionType === 'coding' && languages.length === 0) {
      setError('Please select at least one language for starter code generation')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      // Different endpoint based on question type
      const endpoint = questionType === 'sql' 
        ? '/admin/generate-sql-question' 
        : '/admin/generate-question'
      
      const response = await dsaApi.post(endpoint, {
        difficulty: aiDifficulty,
        topic: aiTopic || undefined,
        concepts: aiConcepts || undefined,
        // Only pass languages for coding questions (not SQL)
        ...(questionType === 'coding' && languages.length > 0 ? { languages } : {}),
      })

      const data = response.data

      // Common fields
      setTitle(data.title || '')
      setDescription(data.description || '')
      setDifficulty(data.difficulty || 'medium')
      
      if (questionType === 'sql') {
        // SQL-specific fields
        setSqlCategory(data.sql_category || 'select')
        setSchemas(data.schemas || {})
        setSampleData(data.sample_data || {})
        setConstraints(data.constraints?.length > 0 ? data.constraints : [''])
        setStarterQuery(data.starter_query || '-- Write your SQL query here\n\nSELECT ')
        setHints(data.hints?.length > 0 ? data.hints : [''])
        setOrderSensitive(data.evaluation?.order_sensitive || false)
      } else {
        // Coding-specific fields
        // Preserve user's selected languages (don't override from response)
        // The backend generates starter code for the languages we sent in the request
        // If no languages were selected, use the response languages as fallback
        if (languages.length === 0 && data.languages && data.languages.length > 0) {
          setLanguages(data.languages)
        }
      
      // Set examples (LeetCode style)
      if (data.examples && data.examples.length > 0) {
        setExamples(data.examples.map((ex: any) => ({
          input: ex.input || '',
          output: ex.output || '',
          explanation: ex.explanation || ''
        })))
      }
      
      // Set constraints (LeetCode style)
      if (data.constraints && data.constraints.length > 0) {
        setConstraints(data.constraints)
      }
      
      // Set starter code only for selected languages
      if (data.starter_code) {
        const newStarterCode: Record<string, string> = {}
        // Only include starter code for languages that were selected and generated
        languages.forEach(lang => {
          newStarterCode[lang] = data.starter_code[lang] || DEFAULT_STARTER_CODE[lang] || ''
        })
        setStarterCode(newStarterCode)
      } else {
        // Fallback: use default starter code for selected languages only
        const newStarterCode: Record<string, string> = {}
        languages.forEach(lang => {
          newStarterCode[lang] = DEFAULT_STARTER_CODE[lang] || ''
        })
        setStarterCode(newStarterCode)
      }
      
      // Set function signature if provided
      if (data.function_signature) {
        setFunctionName(data.function_signature.name || '')
        setReturnType(data.function_signature.return_type || 'int')
        if (data.function_signature.parameters && data.function_signature.parameters.length > 0) {
          setParameters(data.function_signature.parameters)
        }
          setSecureMode(true)
      }

      // Set public testcases - ensure input is always a string
      if (data.public_testcases && data.public_testcases.length > 0) {
        setPublicTestcases(
          data.public_testcases.map((tc: any) => {
            // Always convert input to string for state storage
            const inputStr = typeof tc.input === 'string' ? tc.input : formatTestcaseInput(tc.input)
            return {
              input: inputStr,
              expected_output: tc.expected_output ?? undefined,
            }
          })
        )
      }

      // Set hidden testcases - ensure input is always a string
      if (data.hidden_testcases && data.hidden_testcases.length > 0) {
        setHiddenTestcases(
          data.hidden_testcases.map((tc: any) => {
            // Always convert input to string for state storage
            const inputStr = typeof tc.input === 'string' ? tc.input : formatTestcaseInput(tc.input)
            return {
              input: inputStr,
              expected_output: tc.expected_output ?? undefined,
            }
          })
        )
        }
      }
      
      // Mark as AI-generated
      setIsAiGenerated(true)

      // Show success message
      const typeLabel = questionType === 'sql' ? 'SQL' : 'Coding'
      alert(`✨ ${typeLabel} Question generated successfully! Review and edit as needed.`)
    } catch (err: any) {
      console.error('AI generation error:', err)
      console.error('Error response:', err.response?.data)
      console.error('Error status:', err.response?.status)
      
      let errorMessage = 'Failed to generate question with AI.'
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail
      } else if (err.message) {
        errorMessage = `${errorMessage} Error: ${err.message}`
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Make sure the backend server is running.'
      }
      
      setError(errorMessage)
    } finally {
      setGenerating(false)
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    
    // Validation based on question type
    if (questionType === 'coding') {
    if (languages.length === 0) {
      setError('Select at least one language')
      return
    }
    
    // Validate secure mode settings
    if (secureMode) {
      if (!functionName.trim()) {
        setError('Function name is required when secure mode is enabled')
        return
      }
      const validParams = parameters.filter(p => p.name.trim())
      if (validParams.length === 0) {
        setError('At least one parameter is required when secure mode is enabled')
        return
      }
      }
    } else {
      // SQL validation - schemas are optional for manual creation
      // They can be added via AI generation or later via edit
    }

    setSaving(true)
    setError(null)

    try {
      let payload: any
      
      if (questionType === 'sql') {
        // SQL question payload
        payload = {
          title,
          description,
          difficulty,
          question_type: 'SQL',
          sql_category: sqlCategory,
          schemas,
          sample_data: sampleData,
          constraints: constraints.filter((c) => c.trim()),
          starter_query: starterQuery,
          reference_query: referenceQuery.trim() || null,  // Correct SQL for evaluation
          hints: hints.filter((h) => h.trim()),
          evaluation: {
            engine: 'postgres',
            comparison: 'result_set',
            order_sensitive: orderSensitive,
          },
          is_published: isPublished,
          // Empty coding fields for SQL
          languages: [],
          starter_code: {},
          public_testcases: [],
          hidden_testcases: [],
        }
      } else {
        // Coding question payload
      let functionSignature = null
      if (secureMode && functionName.trim()) {
        functionSignature = {
          name: functionName.trim(),
          parameters: parameters
            .filter(p => p.name.trim())
            .map(p => ({ name: p.name.trim(), type: p.type })),
          return_type: returnType,
        }
      }
      
        payload = {
        title,
        description,
        examples: examples
          .filter((ex) => ex.input.trim() || ex.output.trim())
          .map((ex) => ({
            input: ex.input,
            output: ex.output,
            explanation: ex.explanation || null,
          })),
        constraints: constraints.filter((c) => c.trim()),
        difficulty,
        languages,
        starter_code: starterCode,
        public_testcases: (() => {
          // Filter out empty testcases - only store testcases with actual data
          const nonEmptyTestcases = publicTestcases.filter((tc) => {
            const hasInput = isTestcaseInputNonEmpty(tc.input)
            const hasExpectedOutput = tc.expected_output && typeof tc.expected_output === 'string' && tc.expected_output.trim()
            return hasInput || hasExpectedOutput
          })
          
          // Always include expected_output when present (for both AI-generated and manual questions)
          return nonEmptyTestcases.map((tc) => {
            // Ensure input is always a string, default to empty string if missing
            const inputStr = tc.input 
              ? (typeof tc.input === 'string' ? tc.input : formatTestcaseInput(tc.input))
              : ''
            return {
              input: parseTestcaseInput(inputStr),
              // Parse expected_output so objects/arrays/numbers are stored correctly
              expected_output: parseTestcaseExpectedOutput(tc.expected_output || ''),
              is_hidden: false,
            }
          })
        })(),
        hidden_testcases: (() => {
          // Filter out empty testcases - only store testcases with actual data
          const nonEmptyTestcases = hiddenTestcases.filter((tc) => {
            const hasInput = isTestcaseInputNonEmpty(tc.input)
            const hasExpectedOutput = tc.expected_output && typeof tc.expected_output === 'string' && tc.expected_output.trim()
            return hasInput || hasExpectedOutput
          })
          
          // Always include expected_output when present (for both AI-generated and manual questions)
          return nonEmptyTestcases.map((tc) => {
            // Ensure input is always a string, default to empty string if missing
            const inputStr = tc.input 
              ? (typeof tc.input === 'string' ? tc.input : formatTestcaseInput(tc.input))
              : ''
            return {
              input: parseTestcaseInput(inputStr),
              // Parse expected_output so objects/arrays/numbers are stored correctly
              expected_output: parseTestcaseExpectedOutput(tc.expected_output || ''),
              is_hidden: true,
            }
          })
        })(),
        function_signature: functionSignature,
        secure_mode: secureMode,
        is_published: isPublished,
        }
      }

      await dsaApi.post('/questions', payload)
      const typeLabel = questionType === 'sql' ? 'SQL' : 'Coding'
      alert(`${typeLabel} Question created successfully!`)
      router.push('/dsa/questions')
    } catch (err: any) {
      console.error('Error creating question:', err)
      console.error('Error response:', err.response?.data)
      console.error('Error status:', err.response?.status)
      
      let errorMessage = 'Failed to create question'
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`
      }
      
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Back Button */}
        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            ← Back
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create DSA Question</h1>
            <p className="text-muted-foreground mt-1">
              Create a {questionType === 'sql' ? 'SQL' : 'Coding'} question with AI assistance.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dsa/questions">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : `Create ${questionType === 'sql' ? 'SQL' : 'Coding'} Question`}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Question Type Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Question Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setQuestionType('coding')
                  setIsAiGenerated(false)
                  setTitle('')
                  setDescription('')
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  questionType === 'coding'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Code className={`w-8 h-8 ${questionType === 'coding' ? 'text-purple-400' : 'text-slate-400'}`} />
                  <div className="text-left">
                    <h3 className={`font-semibold ${questionType === 'coding' ? 'text-purple-400' : ''}`}>
                      Coding Question
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Python, Java, C++, JavaScript...
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setQuestionType('sql')
                  setIsAiGenerated(false)
                  setTitle('')
                  setDescription('')
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  questionType === 'sql'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Database className={`w-8 h-8 ${questionType === 'sql' ? 'text-blue-400' : 'text-slate-400'}`} />
                  <div className="text-left">
                    <h3 className={`font-semibold ${questionType === 'sql' ? 'text-blue-400' : ''}`}>
                      SQL Question
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      SELECT, JOIN, Aggregation...
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* AI Question Generator */}
        <Card className={questionType === 'sql' 
          ? "border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-cyan-500/5"
          : "border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-blue-500/5"
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className={`w-5 h-5 ${questionType === 'sql' ? 'text-blue-400' : 'text-purple-400'}`} />
              Generate {questionType === 'sql' ? 'SQL' : 'Coding'} Question with AI
              <span className={`text-xs px-2 py-0.5 rounded ml-2 ${
                questionType === 'sql' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                Powered by GPT-4
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {questionType === 'sql'
                ? 'Describe the SQL topic and concepts, and AI will generate table schemas, sample data, and problem description.'
                : 'Describe the topic and concepts, and AI will generate a complete question with description, starter code, and test cases.'
              }
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Topic</label>
                <Input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder={questionType === 'sql' 
                    ? "e.g., Joins, Aggregation, Window Functions"
                    : "e.g., Arrays, Trees, Graphs"
                  }
                  disabled={generating}
                />
                {questionType === 'sql' && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {SQL_TOPICS.slice(0, 4).map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded"
                        onClick={() => setAiTopic(topic)}
                        disabled={generating}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Concepts</label>
                <Input
                  value={aiConcepts}
                  onChange={(e) => setAiConcepts(e.target.value)}
                  placeholder={questionType === 'sql'
                    ? "e.g., LEFT JOIN, GROUP BY, HAVING"
                    : "e.g., Two pointers, BFS, Dynamic programming"
                  }
                  disabled={generating}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Difficulty</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                  disabled={generating}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {questionType === 'sql' ? (
                    <>
                      <option value="easy">Easy - Basic SELECT, WHERE</option>
                      <option value="medium">Medium - JOINs, GROUP BY</option>
                      <option value="hard">Hard - Window Functions, CTEs</option>
                    </>
                  ) : (
                    <>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Language Selection - Only for Coding Questions */}
            {questionType === 'coding' && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Languages for Starter Code *
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  AI will generate starter code only for the selected languages
                </p>
                <div className="flex flex-wrap gap-4 p-3 border border-input rounded-md bg-background/50">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <label key={lang} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={languages.includes(lang)}
                        onCheckedChange={() => toggleLanguage(lang)}
                        disabled={generating}
                      />
                      <span className="capitalize">{lang}</span>
                    </label>
                  ))}
                </div>
                {languages.length === 0 && (
                  <p className="text-xs text-destructive mt-1">
                    Please select at least one language
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleGenerateWithAI}
              disabled={generating}
              className={questionType === 'sql'
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              }
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating {questionType === 'sql' ? 'SQL' : 'Coding'} Question...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate {questionType === 'sql' ? 'SQL' : 'Coding'} Question
                </>
              )}
            </Button>

            {generating && (
              <p className="text-xs text-muted-foreground">
                {questionType === 'sql'
                  ? 'This may take 10-20 seconds. AI is generating table schemas, sample data, and problem description...'
                  : 'This may take 10-20 seconds. AI is generating title, description, starter code, and test cases...'
                }
              </p>
            )}
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {isAiGenerated ? 'Review and edit generated question' : 'Or create manually'}
            </span>
          </div>
        </div>

            {/* Basic Details - Common for both types */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                    placeholder={questionType === 'sql' ? "e.g., Employee Salary Analysis" : "e.g., Two Sum"}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
                  {questionType === 'sql' && (
                    <div>
                      <label className="text-sm font-medium">SQL Category</label>
                      <select
                        value={sqlCategory}
                        onChange={(e) => setSqlCategory(e.target.value)}
                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {SQL_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
              <div>
                <label className="text-sm font-medium">Publish Status</label>
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    checked={isPublished}
                    onCheckedChange={(val) => setIsPublished(!!val)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Published (visible to users)
                  </span>
                </div>
              </div>
            </div>
                {/* Language selector - only for coding questions */}
                {questionType === 'coding' && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Supported Languages *
              </label>
              <div className="flex flex-wrap gap-4">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <label key={lang} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={languages.includes(lang)}
                      onCheckedChange={() => toggleLanguage(lang)}
                    />
                    <span className="capitalize">{lang}</span>
                  </label>
                ))}
              </div>
            </div>
                )}
          </CardContent>
        </Card>

            {/* Problem Description - Common for both */}
        <Card>
          <CardHeader>
                <CardTitle>Problem Description</CardTitle>
          </CardHeader>
              <CardContent className="space-y-4">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="text-sm"
                  placeholder={questionType === 'sql' 
                    ? "Describe the business problem and what data needs to be retrieved..."
                    : "Write a function that takes an integer as an input and checks if it is a prime number or not..."
                  }
                />
              </CardContent>
            </Card>

            {/* SQL-SPECIFIC SECTIONS */}
            {questionType === 'sql' && (
              <>
                {/* Table Schemas */}
                <Card className="border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table2 className="w-5 h-5 text-blue-400" />
                        Table Schemas
                        {isAiGenerated && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                            AI Generated
                          </span>
                        )}
            </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const tableName = prompt('Enter table name:')
                          if (tableName && tableName.trim()) {
                            setSchemas({
                              ...schemas,
                              [tableName.trim()]: { columns: { id: 'INTEGER' } }
                            })
                            setSampleData({
                              ...sampleData,
                              [tableName.trim()]: []
                            })
                          }
                        }}
                      >
                        + Add Table
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.keys(schemas).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No schemas yet. Use AI to generate or add tables manually.
                      </p>
                    ) : (
                      Object.entries(schemas).map(([tableName, schema]) => (
                        <div key={tableName} className="border border-slate-700 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Table2 className="w-4 h-4 text-blue-400" />
                              <span className="font-mono font-medium text-blue-400">{tableName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-400 hover:text-blue-300 h-7 px-2 text-xs"
                                onClick={() => {
                                  const colName = prompt('Enter column name:')
                                  if (colName && colName.trim()) {
                                    const colType = prompt('Enter column type (e.g., INTEGER, VARCHAR(255), DATE):') || 'VARCHAR(255)'
                                    setSchemas({
                                      ...schemas,
                                      [tableName]: {
                                        columns: {
                                          ...schema.columns,
                                          [colName.trim()]: colType.trim()
                                        }
                                      }
                                    })
                                  }
                                }}
                              >
                                + Column
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 h-7 px-2 text-xs"
                                onClick={() => {
                                  const newSchemas = { ...schemas }
                                  delete newSchemas[tableName]
                                  setSchemas(newSchemas)
                                  const newSampleData = { ...sampleData }
                                  delete newSampleData[tableName]
                                  setSampleData(newSampleData)
                                }}
                              >
                                Remove Table
                              </Button>
                            </div>
                          </div>
                          <div className="bg-slate-900 rounded p-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left py-1">Column</th>
                                  <th className="text-left py-1">Type</th>
                                  <th className="text-right py-1 w-16"></th>
                                </tr>
                              </thead>
                              <tbody className="font-mono">
                                {Object.entries(schema.columns).map(([colName, colType]) => (
                                  <tr key={colName} className="border-t border-slate-800">
                                    <td className="py-1 text-green-400">{colName}</td>
                                    <td className="py-1 text-yellow-400">{String(colType)}</td>
                                    <td className="py-1 text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-400 hover:text-red-300 h-6 px-1 text-xs"
                                        onClick={() => {
                                          const newColumns = { ...schema.columns }
                                          delete newColumns[colName]
                                          setSchemas({
                                            ...schemas,
                                            [tableName]: { columns: newColumns }
                                          })
                                        }}
                                      >
                                        ✕
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Sample Data */}
                <Card className="border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-purple-400" />
                      Sample Data
                      {isAiGenerated && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                          AI Generated
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.keys(sampleData).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        {Object.keys(schemas).length === 0 
                          ? 'Add table schemas first, then sample data will appear here.'
                          : 'No sample data yet. Add rows to your tables.'}
                      </p>
                    ) : (
                      Object.entries(sampleData).map(([tableName, rows]) => {
                        const schema = schemas[tableName]
                        const columns = schema ? Object.keys(schema.columns) : []
                        return (
                          <div key={tableName} className="border border-slate-700 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-purple-400" />
                                <span className="font-mono font-medium text-purple-400">{tableName}</span>
                                <span className="text-xs text-muted-foreground">({rows.length} rows)</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-400 hover:text-purple-300 h-7 px-2 text-xs"
                                onClick={() => {
                                  // Add a new row with empty/default values
                                  const newRow = columns.map(() => '')
                                  setSampleData({
                                    ...sampleData,
                                    [tableName]: [...rows, newRow]
                                  })
                                }}
                              >
                                + Add Row
                              </Button>
                            </div>
                            <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    {columns.map((col) => (
                                      <th key={col} className="text-left py-1 px-2">{col}</th>
                                    ))}
                                    <th className="w-12"></th>
                                  </tr>
                                </thead>
                                <tbody className="font-mono">
                                  {rows.map((row, rowIdx) => (
                                    <tr key={rowIdx} className="border-t border-slate-800">
                                      {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="py-1 px-2">
                                          <Input
                                            value={cell === null ? '' : String(cell)}
                                            onChange={(e) => {
                                              const newRows = [...rows]
                                              newRows[rowIdx] = [...newRows[rowIdx]]
                                              newRows[rowIdx][cellIdx] = e.target.value
                                              setSampleData({
                                                ...sampleData,
                                                [tableName]: newRows
                                              })
                                            }}
                                            className="h-7 text-xs font-mono bg-transparent border-slate-700"
                                            placeholder="value"
                                          />
                                        </td>
                                      ))}
                                      <td className="py-1 px-2 text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-400 hover:text-red-300 h-6 px-1 text-xs"
                                          onClick={() => {
                                            const newRows = rows.filter((_, i) => i !== rowIdx)
                                            setSampleData({
                                              ...sampleData,
                                              [tableName]: newRows
                                            })
                                          }}
                                        >
                                          ✕
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                {/* SQL Starter Query */}
                <Card>
                  <CardHeader>
                    <CardTitle>Starter Query</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={starterQuery}
                      onChange={(e) => setStarterQuery(e.target.value)}
                      rows={4}
                      className="font-mono text-sm"
                      placeholder="-- Write your SQL query here"
                    />
                  </CardContent>
                </Card>

                {/* Reference Query (Correct Answer) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Reference Query (Correct Answer)</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      This is the correct SQL query that produces the expected output. 
                      Candidate submissions will be compared against this query's results.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={referenceQuery}
                      onChange={(e) => setReferenceQuery(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                      placeholder="SELECT column1, column2 FROM table_name WHERE condition ORDER BY column1;"
                    />
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ This query is never shown to candidates. It is only used to generate the expected output for comparison.
                    </p>
                  </CardContent>
                </Card>

                {/* SQL Evaluation Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evaluation Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={orderSensitive}
                        onCheckedChange={(val) => setOrderSensitive(!!val)}
                      />
                      <div>
                        <label className="text-sm font-medium">Order Sensitive</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          When enabled, results must be in the exact same order as expected.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* CODING-SPECIFIC SECTIONS */}
            {questionType === 'coding' && (
              <>
                {/* Problem Details - Examples */}
                <Card>
                  <CardHeader>
                    <CardTitle>Examples</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
            {/* Examples */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Examples</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExamples([...examples, { input: '', output: '', explanation: '' }])}
                >
                  + Add Example
                </Button>
              </div>
              <div className="space-y-3">
                {examples.map((example, idx) => (
                  <div key={idx} className="border border-slate-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Example {idx + 1}</span>
                      {examples.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 h-6 px-2"
                          onClick={() => setExamples(examples.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Input</label>
                        <Input
                          value={example.input}
                          onChange={(e) => {
                            const newExamples = [...examples]
                            newExamples[idx].input = e.target.value
                            setExamples(newExamples)
                          }}
                          placeholder='n = 7'
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Output</label>
                        <Input
                          value={example.output}
                          onChange={(e) => {
                            const newExamples = [...examples]
                            newExamples[idx].output = e.target.value
                            setExamples(newExamples)
                          }}
                          placeholder='"Prime"'
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Explanation (optional)</label>
                      <Input
                        value={example.explanation}
                        onChange={(e) => {
                          const newExamples = [...examples]
                          newExamples[idx].explanation = e.target.value
                          setExamples(newExamples)
                        }}
                        placeholder='7 has only 2 factors: 1 and 7'
                        className="text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Secure Mode Settings */}
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Secure Mode
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                Prevents cheating
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={secureMode}
                onCheckedChange={(val) => setSecureMode(!!val)}
                disabled={isAiGenerated}
              />
              <div>
                <label className="text-sm font-medium">Enable Secure Mode</label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, users can only write the function body. The system blocks:
                  <br />• <code className="text-orange-400">main()</code>, <code className="text-orange-400">System.out.println()</code>, <code className="text-orange-400">Scanner</code> (Java)
                  <br />• <code className="text-orange-400">print()</code>, <code className="text-orange-400">input()</code> (Python)
                  <br />• <code className="text-orange-400">cout</code>, <code className="text-orange-400">cin</code>, <code className="text-orange-400">main()</code> (C++)
                  <br />• <code className="text-orange-400">console.log()</code>, <code className="text-orange-400">prompt()</code> (JavaScript)
                </p>
              </div>
            </div>

            {secureMode && (
              <div className="border border-orange-500/20 rounded-lg p-4 space-y-4 bg-orange-500/5">
                <h4 className="font-medium text-sm">Function Signature</h4>
                <p className="text-xs text-muted-foreground">
                  Define the function that users must implement. The system will automatically
                  handle reading input and printing output.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium">Function Name *</label>
                    <Input
                      value={functionName}
                      onChange={(e) => setFunctionName(e.target.value)}
                      placeholder="e.g., twoSum, isPrime, reverseString"
                      className="font-mono"
                      disabled={isAiGenerated}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Return Type *</label>
                    <select
                      value={returnType}
                      onChange={(e) => setReturnType(e.target.value)}
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      disabled={isAiGenerated}
                    >
                      <option value="int">int</option>
                      <option value="long">long</option>
                      <option value="double">double</option>
                      <option value="boolean">boolean</option>
                      <option value="string">string</option>
                      <option value="int[]">int[] (array)</option>
                      <option value="string[]">string[] (array)</option>
                      <option value="int[][]">int[][] (2D array)</option>
                      <option value="List<Integer>">List&lt;Integer&gt;</option>
                      <option value="List<String>">List&lt;String&gt;</option>
                      <option value="void">void</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">Parameters *</label>
                  <div className="space-y-2">
                    {parameters.map((param, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          value={param.name}
                          onChange={(e) => {
                            const newParams = [...parameters]
                            newParams[idx].name = e.target.value
                            setParameters(newParams)
                          }}
                          placeholder="Parameter name"
                          className="font-mono flex-1"
                          disabled={isAiGenerated}
                        />
                        <select
                          value={param.type}
                          onChange={(e) => {
                            const newParams = [...parameters]
                            newParams[idx].type = e.target.value
                            setParameters(newParams)
                          }}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                          disabled={isAiGenerated}
                        >
                          <option value="int">int</option>
                          <option value="long">long</option>
                          <option value="double">double</option>
                          <option value="boolean">boolean</option>
                          <option value="string">string</option>
                          <option value="int[]">int[]</option>
                          <option value="string[]">string[]</option>
                          <option value="int[][]">int[][]</option>
                          <option value="List<Integer>">List&lt;Integer&gt;</option>
                          <option value="List<String>">List&lt;String&gt;</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (parameters.length > 1) {
                              setParameters(parameters.filter((_, i) => i !== idx))
                            }
                          }}
                          disabled={parameters.length === 1 || isAiGenerated}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setParameters([...parameters, { name: '', type: 'int' }])}
                    disabled={isAiGenerated}
                  >
                    + Add Parameter
                  </Button>
                  {isAiGenerated && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ℹ️ Function signature is AI-generated and cannot be modified
                    </p>
                  )}
                </div>

                <div className="bg-slate-900 rounded p-3 mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Preview (Java):</p>
                  <code className="text-sm text-green-400 font-mono">
                    public static {returnType} {functionName || 'functionName'}(
                    {parameters
                      .filter(p => p.name)
                      .map(p => `${p.type} ${p.name}`)
                      .join(', ')})
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Starter Code */}
        <Card>
          <CardHeader>
            <CardTitle>Starter Code (Boilerplate)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide starter code for each language. This is what users will see
              when they start the problem.
            </p>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <div key={lang}>
                <label className="text-sm font-medium capitalize flex items-center gap-2">
                  {lang}
                  {languages.includes(lang) && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                      enabled
                    </span>
                  )}
                </label>
                <Textarea
                  className="font-mono text-sm mt-2"
                  rows={6}
                  value={starterCode[lang] || ''}
                  onChange={(e) =>
                    setStarterCode((prev) => ({
                      ...prev,
                      [lang]: e.target.value,
                    }))
                  }
                  disabled={isAiGenerated}
                  placeholder={isAiGenerated ? "AI-generated starter code (cannot be edited)" : "Enter starter code for this language"}
                />
              </div>
            ))}
            {isAiGenerated && (
              <p className="text-xs text-muted-foreground mt-2">
                ℹ️ Starter code is AI-generated and cannot be modified. Generated for {languages.length} selected language{languages.length !== 1 ? 's' : ''}: {languages.join(', ')}.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Public Test Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Public Test Cases
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                Visible to users
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These test cases are shown to users. They can see the input, expected
              output, and their output. Use 2-3 simple examples.
            </p>
            {publicTestcases.map((tc, idx) => (
              <div
                key={`public-${idx}`}
                className="rounded-md border border-border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Public Test Case {idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTestcase('public', idx)}
                    disabled={publicTestcases.length === 1}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium">Input (stdin)</label>
                    <Textarea
                      rows={3}
                      className="font-mono text-sm"
                      value={formatTestcaseInput(tc.input)}
                      onChange={(e) =>
                        updateTestcase(idx, 'public', 'input', e.target.value)
                      }
                      placeholder={getStdinPlaceholder()}
                    />
                  </div>
                  <div>
                      <label className="text-xs font-medium">Expected Output</label>
                    <Textarea
                      rows={3}
                      className="font-mono text-sm"
                      value={formatTestcaseExpectedOutput(tc.expected_output)}
                      onChange={(e) =>
                        updateTestcase(idx, 'public', 'expected_output', e.target.value)
                      }
                      placeholder={
                        getExpectedOutputPlaceholder(returnType)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addTestcase('public')}
            >
              + Add Public Test Case
            </Button>
          </CardContent>
        </Card>

        {/* Hidden Test Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Hidden Test Cases
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                Hidden from users
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These test cases are <strong>never shown to users</strong>. They only see
              "Passed" or "Failed". Use edge cases and stress tests to prevent
              hardcoding.
            </p>
            {hiddenTestcases.map((tc, idx) => (
              <div
                key={`hidden-${idx}`}
                className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Hidden Test Case {idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTestcase('hidden', idx)}
                    disabled={hiddenTestcases.length === 1}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium">Input (stdin)</label>
                    <Textarea
                      rows={3}
                      className="font-mono text-sm"
                      value={formatTestcaseInput(tc.input)}
                      onChange={(e) =>
                        updateTestcase(idx, 'hidden', 'input', e.target.value)
                      }
                      placeholder={getStdinPlaceholder()}
                    />
                  </div>
                  <div>
                      <label className="text-xs font-medium">Expected Output</label>
                    <Textarea
                      rows={3}
                      className="font-mono text-sm"
                      value={formatTestcaseExpectedOutput(tc.expected_output)}
                      onChange={(e) =>
                        updateTestcase(idx, 'hidden', 'expected_output', e.target.value)
                      }
                      placeholder={
                        getExpectedOutputPlaceholder(returnType)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addTestcase('hidden')}
            >
              + Add Hidden Test Case
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Constraints - Common for both */}
            <Card>
              <CardHeader>
                <CardTitle>Constraints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {constraints.map((constraint, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={constraint}
                        onChange={(e) => {
                          const newConstraints = [...constraints]
                          newConstraints[idx] = e.target.value
                          setConstraints(newConstraints)
                        }}
                        placeholder={questionType === 'sql' 
                          ? "e.g., Results must be ordered by salary DESC"
                          : "e.g., 0 <= n <= 5 * 10^6"
                        }
                        className="font-mono text-sm flex-1"
                      />
                      {constraints.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 h-8 px-2"
                          onClick={() => setConstraints(constraints.filter((_, i) => i !== idx))}
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConstraints([...constraints, ''])}
                >
                  + Add Constraint
            </Button>
          </CardContent>
        </Card>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/dsa/questions">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : `Create ${questionType === 'sql' ? 'SQL' : 'Coding'} Question`}
          </Button>
        </div>
      </div>
    </div>
  )
}

