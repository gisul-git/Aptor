'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/dsa/ui/card'
import { Button } from '../../../../components/dsa/ui/button'
import { Input } from '../../../../components/dsa/ui/input'
import { Textarea } from '../../../../components/dsa/ui/textarea'
import { Checkbox } from '../../../../components/dsa/ui/checkbox'
import dsaApi from '../../../../lib/dsa/api'
import { Sparkles, Loader2 } from 'lucide-react'

type Testcase = {
  input: string
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
const formatTestcaseExpectedOutput = (expectedOutput: any): string => {
  if (expectedOutput === null || expectedOutput === undefined) {
    return ''
  }
  if (typeof expectedOutput === 'string') {
    return expectedOutput
  }
  // For objects, arrays, numbers, booleans - convert to JSON string
  try {
    // If it's a primitive (number, boolean), just convert to string
    if (typeof expectedOutput !== 'object') {
      return String(expectedOutput)
    }
    // For objects/arrays, stringify with formatting
    return JSON.stringify(expectedOutput, null, 2)
  } catch (e) {
    return String(expectedOutput)
  }
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

// Helper function to parse expected_output back to JSON value if valid JSON, otherwise keep as string
const parseTestcaseExpectedOutput = (expectedOutput: string): any => {
  if (!expectedOutput || !expectedOutput.trim()) {
    return expectedOutput || ''
  }
  // Try to parse as JSON (could be object, array, number, boolean, string, or null)
  try {
    const parsed = JSON.parse(expectedOutput.trim())
    // Return the parsed value (could be any JSON value)
    return parsed
  } catch (e) {
    // Not valid JSON, return as string (legacy format)
    return expectedOutput
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
const SUPPORTED_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'cpp',
  'java',
  'c',
  'go',
  'rust',
  'csharp',
  'kotlin',
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

export default function QuestionEditPage() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // AI Generation fields
  const [aiTopic, setAiTopic] = useState('')
  const [aiConcepts, setAiConcepts] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('medium')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [examples, setExamples] = useState<Array<{input: string, output: string, explanation: string}>>([
    { input: '', output: '', explanation: '' }
  ])
  const [constraints, setConstraints] = useState<string[]>([''])
  
  const [difficulty, setDifficulty] = useState('medium')
  const [languages, setLanguages] = useState<string[]>(['python'])
  const [isPublished, setIsPublished] = useState(false)
  const [starterCode, setStarterCode] = useState<Record<string, string>>({})
  const [publicTestcases, setPublicTestcases] = useState<Testcase[]>([
    { input: '', expected_output: '' }
  ])
  const [hiddenTestcases, setHiddenTestcases] = useState<Testcase[]>([
    { input: '', expected_output: '' }
  ])
  
  // Secure Mode settings
  const [secureMode, setSecureMode] = useState(false)
  const [functionName, setFunctionName] = useState('')
  const [returnType, setReturnType] = useState('int')
  const [parameters, setParameters] = useState<Array<{name: string, type: string}>>([
    { name: '', type: 'int' }
  ])
  const [isAiGenerated, setIsAiGenerated] = useState(false)

  // Load question data
  useEffect(() => {
    if (id && typeof id === 'string') {
      loadQuestion(id)
    }
  }, [id])

  const loadQuestion = async (questionId: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await dsaApi.get(`/questions/${questionId}`)
      const data = response.data

      // Check if this is an SQL question and redirect to SQL edit page
      if (data.question_type === 'SQL') {
        router.push(`/dsa/questions/${questionId}/edit-sql`)
        return
      }

      // Populate form fields
      setTitle(data.title || '')
      setDescription(data.description || '')
      setDifficulty(data.difficulty || 'medium')
      setLanguages(data.languages || ['python'])
      setIsPublished(data.is_published || false)
      
      // Set examples
      if (data.examples && data.examples.length > 0) {
        setExamples(data.examples.map((ex: any) => ({
          input: ex.input || '',
          output: ex.output || '',
          explanation: ex.explanation || ''
        })))
      } else {
        setExamples([{ input: '', output: '', explanation: '' }])
      }
      
      // Set constraints
      if (data.constraints && data.constraints.length > 0) {
        setConstraints(data.constraints)
      } else {
        setConstraints([''])
      }
      
      // Set starter code
      if (data.starter_code) {
        const newStarterCode: Record<string, string> = {}
        SUPPORTED_LANGUAGES.forEach(lang => {
          newStarterCode[lang] = data.starter_code[lang] || DEFAULT_STARTER_CODE[lang] || ''
        })
        setStarterCode(newStarterCode)
      } else {
        const newStarterCode: Record<string, string> = {}
        SUPPORTED_LANGUAGES.forEach(lang => {
          newStarterCode[lang] = DEFAULT_STARTER_CODE[lang] || ''
        })
        setStarterCode(newStarterCode)
      }
      
      // Set function signature
      if (data.function_signature) {
        setFunctionName(data.function_signature.name || '')
        setReturnType(data.function_signature.return_type || 'int')
        if (data.function_signature.parameters && data.function_signature.parameters.length > 0) {
          setParameters(data.function_signature.parameters)
        }
        setSecureMode(true)
      } else {
        setSecureMode(data.secure_mode || false)
      }
      
      // Set testcases
      if (data.public_testcases && data.public_testcases.length > 0) {
        setPublicTestcases(
          data.public_testcases.map((tc: any) => ({
            input: formatTestcaseInput(tc.input),
            expected_output: formatTestcaseExpectedOutput(tc.expected_output), // Format expected_output (handles objects/arrays/strings/null)
          }))
        )
      } else {
        setPublicTestcases([{ input: '', expected_output: '' }])
      }

      if (data.hidden_testcases && data.hidden_testcases.length > 0) {
        setHiddenTestcases(
          data.hidden_testcases.map((tc: any) => ({
            input: formatTestcaseInput(tc.input),
            expected_output: formatTestcaseExpectedOutput(tc.expected_output), // Format expected_output (handles objects/arrays/strings/null)
          }))
        )
      } else {
        setHiddenTestcases([{ input: '', expected_output: '' }])
      }

      // Backend can explicitly mark AI-generated questions once it computes expected_output
      if (data.ai_generated === true) {
        setIsAiGenerated(true)
      }
    } catch (err: any) {
      console.error('Error loading question:', err)
      setError(err.response?.data?.detail || 'Failed to load question')
    } finally {
      setLoading(false)
    }
  }

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
        copy[idx] = { ...copy[idx], [field]: value }
        return copy
      })
    } else {
      setHiddenTestcases((prev) => {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], [field]: value }
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

  // AI Generation handler
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim() && !aiConcepts.trim()) {
      setError('Please provide a topic or concepts for AI generation')
      return
    }

    // Ensure at least one language is selected
    if (languages.length === 0) {
      setError('Please select at least one language for starter code generation')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const response = await dsaApi.post('/admin/generate-question', {
        difficulty: aiDifficulty,
        topic: aiTopic || undefined,
        concepts: aiConcepts || undefined,
        // Pass selected languages to generate starter code only for those languages
        ...(languages.length > 0 ? { languages } : {}),
      })

      const data = response.data

      // Auto-fill form with generated data
      setTitle(data.title || '')
      setDescription(data.description || '')
      setDifficulty(data.difficulty || 'medium')
      // Preserve user's selected languages (don't override from response)
      // The backend generates starter code for the languages we sent in the request
      // If no languages were selected, use the response languages as fallback
      if (languages.length === 0 && data.languages && data.languages.length > 0) {
        setLanguages(data.languages)
      }
      
      if (data.examples && data.examples.length > 0) {
        setExamples(data.examples.map((ex: any) => ({
          input: ex.input || '',
          output: ex.output || '',
          explanation: ex.explanation || ''
        })))
      }
      
      if (data.constraints && data.constraints.length > 0) {
        setConstraints(data.constraints)
      }
      
      if (data.starter_code) {
        const newStarterCode: Record<string, string> = {}
        // Only include starter code for languages that were selected and generated
        languages.forEach(lang => {
          newStarterCode[lang] = data.starter_code[lang] || ''
        })
        setStarterCode(newStarterCode)
      }
      
      if (data.function_signature) {
        setFunctionName(data.function_signature.name || '')
        setReturnType(data.function_signature.return_type || 'int')
        if (data.function_signature.parameters && data.function_signature.parameters.length > 0) {
          setParameters(data.function_signature.parameters)
        }
        setSecureMode(true)
      }
      
      setIsAiGenerated(true)

      if (data.public_testcases && data.public_testcases.length > 0) {
        setPublicTestcases(
          data.public_testcases.map((tc: any) => ({
            input: formatTestcaseInput(tc.input),
            expected_output: tc.expected_output || '',
          }))
        )
      }

      if (data.hidden_testcases && data.hidden_testcases.length > 0) {
        setHiddenTestcases(
          data.hidden_testcases.map((tc: any) => ({
            input: formatTestcaseInput(tc.input),
            expected_output: tc.expected_output || '',
          }))
        )
      }

      alert('✨ Question generated successfully! Review and edit as needed.')
    } catch (err: any) {
      console.error('AI generation error:', err)
      setError(
        err.response?.data?.detail || 
        'Failed to generate question with AI. Make sure your OpenAI API key is configured.'
      )
    } finally {
      setGenerating(false)
    }
  }

  const handleUpdate = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (languages.length === 0) {
      setError('Select at least one language')
      return
    }
    
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

    if (!id || typeof id !== 'string') {
      setError('Invalid question ID')
      return
    }

    setSaving(true)
    setError(null)

    try {
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
      
      const payload = {
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
          
          // Include expected_output if it exists (for both AI-generated and manual questions)
          // AI-generated questions may have expected_output computed after creation
          return nonEmptyTestcases.map((tc) => {
            // Ensure input is always a string, default to empty string if missing
            const inputStr = tc.input 
              ? (typeof tc.input === 'string' ? tc.input : formatTestcaseInput(tc.input))
              : ''
            const expectedOutputStr = tc.expected_output || ''
            return {
              input: parseTestcaseInput(inputStr),
              expected_output: expectedOutputStr ? parseTestcaseExpectedOutput(expectedOutputStr) : '', // Parse JSON if valid, otherwise keep as string
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
          
          // Include expected_output if it exists (for both AI-generated and manual questions)
          // AI-generated questions may have expected_output computed after creation
          return nonEmptyTestcases.map((tc) => {
            // Ensure input is always a string, default to empty string if missing
            const inputStr = tc.input 
              ? (typeof tc.input === 'string' ? tc.input : formatTestcaseInput(tc.input))
              : ''
            const expectedOutputStr = tc.expected_output || ''
            return {
              input: parseTestcaseInput(inputStr),
              expected_output: expectedOutputStr ? parseTestcaseExpectedOutput(expectedOutputStr) : '', // Parse JSON if valid, otherwise keep as string
              is_hidden: true,
            }
          })
        })(),
        function_signature: functionSignature,
        secure_mode: secureMode,
        is_published: isPublished,
      }

      await dsaApi.put(`/questions/${id}`, payload)
      alert('Question updated successfully!')
      router.push('/dsa/questions')
    } catch (err: any) {
      console.error('Error updating question:', err)
      console.error('Error response:', err.response?.data)
      console.error('Error status:', err.response?.status)
      
      let errorMessage = 'Failed to update question'
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading question...</p>
        </div>
      </div>
    )
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
            <h1 className="text-3xl font-bold">Edit Question</h1>
            <p className="text-muted-foreground mt-1">
              Update the coding question details.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dsa/questions">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? 'Updating...' : 'Update Question'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* AI Question Generator */}
        <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Generate Question with AI
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded ml-2">
                Powered by GPT-4
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe the topic and concepts, and AI will generate a complete question with 
              description, starter code, and test cases. This will replace your current question.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Topic</label>
                <Input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., Arrays, Trees, Graphs"
                  disabled={generating}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Concepts</label>
                <Input
                  value={aiConcepts}
                  onChange={(e) => setAiConcepts(e.target.value)}
                  placeholder="e.g., Two pointers, BFS, Dynamic programming"
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
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Language Selection */}
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

            <Button
              onClick={handleGenerateWithAI}
              disabled={generating}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Question
                </>
              )}
            </Button>

            {generating && (
              <p className="text-xs text-muted-foreground">
                This may take 10-20 seconds. AI is generating title, description, 
                starter code, and test cases...
              </p>
            )}
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or edit manually
            </span>
          </div>
        </div>

        {/* Basic Details */}
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
                placeholder="e.g., Two Sum"
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
          </CardContent>
        </Card>

        {/* Problem Details */}
        <Card>
          <CardHeader>
            <CardTitle>Problem Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="text-sm"
                placeholder="Write a function that takes an integer as an input and checks if it is a prime number or not..."
              />
            </div>

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

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Constraints</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConstraints([...constraints, ''])}
                >
                  + Add Constraint
                </Button>
              </div>
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
                      placeholder='0 <= n <= 5 * 10^6'
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
                      value={tc.expected_output ?? ''}
                      onChange={(e) =>
                        updateTestcase(idx, 'public', 'expected_output', e.target.value)
                      }
                      placeholder={getExpectedOutputPlaceholder(returnType)}
                      disabled={isAiGenerated}
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
                      value={tc.expected_output ?? ''}
                      onChange={(e) =>
                        updateTestcase(idx, 'hidden', 'expected_output', e.target.value)
                      }
                      placeholder={getExpectedOutputPlaceholder(returnType)}
                      disabled={isAiGenerated}
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

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/dsa/questions">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleUpdate} disabled={saving}>
            {saving ? 'Updating...' : 'Update Question'}
          </Button>
        </div>
      </div>
    </div>
  )
}





