import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { useAIMLQuestion, useUpdateAIMLQuestion } from '@/hooks/api/useAIML'

const AIML_LIBRARIES = ['numpy', 'matplotlib', 'pandas', 'scikit-learn', 'scipy', 'tensorflow', 'pytorch', 'keras']

const DEFAULT_PYTHON_STARTER = `import numpy as np
# Your code here
`

type Testcase = {
  input: string
  expected_output: string
}

export default function AIMLQuestionEditPage() {
  const router = useRouter()
  const { id: questionId } = router.query
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Question fields
  const [library, setLibrary] = useState('numpy')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [examples, setExamples] = useState<Array<{input: string, output: string, explanation: string}>>([])
  const [constraints, setConstraints] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState('medium')
  const [starterCode, setStarterCode] = useState<Record<string, string>>({
    python3: DEFAULT_PYTHON_STARTER,
  })
  const [publicTestcases, setPublicTestcases] = useState<Testcase[]>([])
  const [hiddenTestcases, setHiddenTestcases] = useState<Testcase[]>([])
  const [requiresDataset, setRequiresDataset] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)

  // React Query hook
  const { data: questionData, isLoading: loadingQuestion } = useAIMLQuestion(questionId as string)
  const updateQuestionMutation = useUpdateAIMLQuestion()
  
  // Update local state from React Query data
  useEffect(() => {
    if (questionData) {
      const question = questionData as any
      
      setTitle(question.title || '')
      setDescription(question.description || '')
      setDifficulty(question.difficulty || 'medium')
      setLibrary(question.library || 'numpy')
      setExamples(question.examples || [])
      setConstraints(question.constraints || [])
      setStarterCode(question.starter_code || { python3: DEFAULT_PYTHON_STARTER })
      setPublicTestcases(question.public_testcases || [])
      setHiddenTestcases(question.hidden_testcases || [])
      setRequiresDataset(question.requires_dataset || false)
      setIsPublished(question.is_published || false)
      setAiGenerated(question.ai_generated || false)
      setLoading(false)
    }
  }, [questionData])

  // Handle loading state from React Query
  useEffect(() => {
    if (loadingQuestion !== undefined) {
      setLoading(loadingQuestion)
    }
  }, [loadingQuestion])

  const addExample = () => {
    setExamples([...examples, { input: '', output: '', explanation: '' }])
  }

  const removeExample = (idx: number) => {
    setExamples(examples.filter((_, i) => i !== idx))
  }

  const updateExample = (idx: number, field: string, value: string) => {
    const updated = [...examples]
    updated[idx] = { ...updated[idx], [field]: value }
    setExamples(updated)
  }

  const addConstraint = () => {
    setConstraints([...constraints, ''])
  }

  const removeConstraint = (idx: number) => {
    setConstraints(constraints.filter((_, i) => i !== idx))
  }

  const updateConstraint = (idx: number, value: string) => {
    const updated = [...constraints]
    updated[idx] = value
    setConstraints(updated)
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
      setPublicTestcases([...publicTestcases, { input: '', expected_output: '' }])
    } else {
      setHiddenTestcases([...hiddenTestcases, { input: '', expected_output: '' }])
    }
  }

  const removeTestcase = (type: 'public' | 'hidden', idx: number) => {
    if (type === 'public') {
      setPublicTestcases(publicTestcases.filter((_, i) => i !== idx))
    } else {
      setHiddenTestcases(hiddenTestcases.filter((_, i) => i !== idx))
    }
  }

  const handleUpdate = async () => {
    if (!title.trim()) {
      alert('Title is required')
      return
    }

    if (!description.trim()) {
      alert('Description is required')
      return
    }

    if (publicTestcases.length === 0 || hiddenTestcases.length === 0) {
      alert('At least one public and one hidden test case is required')
      return
    }

    if (!questionId) {
      alert('Question ID is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        title,
        description,
        examples: examples.filter(ex => ex.input.trim() || ex.output.trim()),
        constraints: constraints.filter(c => c.trim()),
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        languages: ['python3'],
        public_testcases: publicTestcases.filter(tc => tc.input.trim() || tc.expected_output.trim()),
        hidden_testcases: hiddenTestcases.filter(tc => tc.input.trim() || tc.expected_output.trim()),
        starter_code: starterCode,
        library,
        requires_dataset: requiresDataset,
        is_published: isPublished,
      } as any

      await updateQuestionMutation.mutateAsync({
        questionId: questionId as string,
        data: payload,
      })
      alert('Question updated successfully!')
      router.push('/aiml/questions')
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || err.message || 'Failed to update question')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Loading question...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/aiml/questions")}
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

        <div className="card">
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>Edit AIML Question</h1>

          {error && (
            <div style={{ padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "0.5rem", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          {/* Library Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Library *
            </label>
            <select
              value={library}
              onChange={(e) => setLibrary(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.375rem",
              }}
            >
              {AIML_LIBRARIES.map((lib) => (
                <option key={lib} value={lib}>
                  {lib}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Question title"
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.375rem",
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Question description"
              rows={6}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.375rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Difficulty *
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.375rem",
              }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Examples */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Examples</label>
              <button type="button" onClick={addExample} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                + Add Example
              </button>
            </div>
            {examples.map((ex, idx) => (
              <div key={idx} style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600 }}>Example {idx + 1}</span>
                  <button type="button" onClick={() => removeExample(idx)} style={{ color: "#DC2626" }}>
                    Remove
                  </button>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Input</label>
                  <textarea
                    value={ex.input}
                    onChange={(e) => updateExample(idx, 'input', e.target.value)}
                    rows={2}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem" }}
                  />
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Output</label>
                  <textarea
                    value={ex.output}
                    onChange={(e) => updateExample(idx, 'output', e.target.value)}
                    rows={2}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Explanation (optional)</label>
                  <textarea
                    value={ex.explanation || ''}
                    onChange={(e) => updateExample(idx, 'explanation', e.target.value)}
                    rows={2}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Constraints */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Constraints</label>
              <button type="button" onClick={addConstraint} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                + Add Constraint
              </button>
            </div>
            {constraints.map((constraint, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="text"
                  value={constraint}
                  onChange={(e) => updateConstraint(idx, e.target.value)}
                  placeholder="Constraint"
                  style={{ flex: 1, padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem" }}
                />
                <button type="button" onClick={() => removeConstraint(idx)} style={{ color: "#DC2626", padding: "0.5rem 1rem" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Starter Code */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Starter Code (Python 3)
            </label>
            <textarea
              value={starterCode.python3 || ''}
              onChange={(e) => setStarterCode({ ...starterCode, python3: e.target.value })}
              rows={10}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.375rem",
                fontFamily: "monospace",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Public Test Cases */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Public Test Cases *</label>
              <button type="button" onClick={() => addTestcase('public')} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                + Add Test Case
              </button>
            </div>
            {publicTestcases.map((tc, idx) => (
              <div key={idx} style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600 }}>Test Case {idx + 1}</span>
                  <button type="button" onClick={() => removeTestcase('public', idx)} style={{ color: "#DC2626" }}>
                    Remove
                  </button>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Input</label>
                  <textarea
                    value={tc.input}
                    onChange={(e) => updateTestcase(idx, 'public', 'input', e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem", fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Expected Output</label>
                  <textarea
                    value={tc.expected_output}
                    onChange={(e) => updateTestcase(idx, 'public', 'expected_output', e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem", fontFamily: "monospace" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Hidden Test Cases */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Hidden Test Cases *</label>
              <button type="button" onClick={() => addTestcase('hidden')} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                + Add Test Case
              </button>
            </div>
            {hiddenTestcases.map((tc, idx) => (
              <div key={idx} style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600 }}>Test Case {idx + 1}</span>
                  <button type="button" onClick={() => removeTestcase('hidden', idx)} style={{ color: "#DC2626" }}>
                    Remove
                  </button>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Input</label>
                  <textarea
                    value={tc.input}
                    onChange={(e) => updateTestcase(idx, 'hidden', 'input', e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem", fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Expected Output</label>
                  <textarea
                    value={tc.expected_output}
                    onChange={(e) => updateTestcase(idx, 'hidden', 'expected_output', e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem", fontFamily: "monospace" }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Options */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requiresDataset}
                onChange={(e) => setRequiresDataset(e.target.checked)}
              />
              <span>Requires Dataset</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginTop: "0.5rem" }}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span>Published</span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleUpdate}
              disabled={saving}
              style={{ padding: "0.75rem 2rem" }}
            >
              {saving ? "Updating..." : "Update Question"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/aiml/questions")}
              style={{ padding: "0.75rem 2rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth




