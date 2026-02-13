import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { useAIMLQuestion, useUpdateAIMLQuestion } from '@/hooks/api/useAIML'

const AIML_LIBRARIES = ['numpy', 'matplotlib', 'pandas', 'scikit-learn', 'scipy', 'tensorflow', 'pytorch', 'keras']

const DEFAULT_PYTHON_STARTER = `import numpy as np
# Your code here
`

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
  const [requiresDataset, setRequiresDataset] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)
  
  // New format fields
  const [tasks, setTasks] = useState<string[]>([])
  const [questionType, setQuestionType] = useState<string>('aiml_coding')
  const [executionEnvironment, setExecutionEnvironment] = useState<string>('jupyter_notebook')
  
  // Assessment metadata
  const [skill, setSkill] = useState<string>('Python')
  const [topic, setTopic] = useState<string>('')
  const [libraries, setLibraries] = useState<string[]>([])
  const [selectedDatasetFormat, setSelectedDatasetFormat] = useState<string>('csv')
  
  // Dataset
  const [dataset, setDataset] = useState<any>(null)
  
  // Dataset editing state
  const [editingDataset, setEditingDataset] = useState(false)

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
      setRequiresDataset(question.requires_dataset || false)
      setIsPublished(question.is_published || false)
      setAiGenerated(question.ai_generated || false)
      
      // New format fields
      setTasks(question.tasks || [])
      setQuestionType(question.question_type || 'aiml_coding')
      setExecutionEnvironment(question.execution_environment || 'jupyter_notebook')
      
      // Assessment metadata
      const assessmentMeta = question.assessment_metadata || {}
      setSkill(assessmentMeta.skill || question.library || 'Python')
      setTopic(assessmentMeta.topic || '')
      setLibraries(assessmentMeta.libraries || [])
      setSelectedDatasetFormat(assessmentMeta.selected_dataset_format || 'csv')
      
      // Dataset
      const datasetData = question.dataset || null
      setDataset(datasetData)
      setEditingDataset(false)
      
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

  const addTask = () => {
    setTasks([...tasks, ''])
  }

  const removeTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx))
  }

  const updateTask = (idx: number, value: string) => {
    const updated = [...tasks]
    updated[idx] = value
    setTasks(updated)
  }

  const addLibrary = () => {
    setLibraries([...libraries, ''])
  }

  const removeLibrary = (idx: number) => {
    setLibraries(libraries.filter((_, i) => i !== idx))
  }

  const updateLibrary = (idx: number, value: string) => {
    const updated = [...libraries]
    updated[idx] = value
    setLibraries(updated)
  }

  // Dataset editing functions
  const updateDatasetRow = (rowIndex: number, colIndex: number, value: any) => {
    if (!dataset || !dataset.rows) return
    const updated = { ...dataset }
    updated.rows = [...updated.rows]
    updated.rows[rowIndex] = [...updated.rows[rowIndex]]
    updated.rows[rowIndex][colIndex] = value
    setDataset(updated)
  }

  const addDatasetRow = () => {
    if (!dataset || !dataset.schema) return
    const newRow = dataset.schema.map(() => '')
    const updated = { ...dataset }
    updated.rows = [...(updated.rows || []), newRow]
    setDataset(updated)
  }

  const removeDatasetRow = (rowIndex: number) => {
    if (!dataset || !dataset.rows) return
    const updated = { ...dataset }
    updated.rows = updated.rows.filter((_: any, idx: number) => idx !== rowIndex)
    setDataset(updated)
  }

  const updateDatasetSchema = (colIndex: number, field: 'name' | 'type', value: string) => {
    if (!dataset || !dataset.schema) return
    const updated = { ...dataset }
    updated.schema = [...updated.schema]
    updated.schema[colIndex] = { ...updated.schema[colIndex], [field]: value }
    setDataset(updated)
  }

  const addDatasetColumn = () => {
    if (!dataset) return
    const updated = { ...dataset }
    updated.schema = [...(updated.schema || []), { name: `column_${(updated.schema?.length || 0) + 1}`, type: 'string' }]
    // Add empty value to all existing rows
    if (updated.rows) {
      updated.rows = updated.rows.map((row: any[]) => [...row, ''])
    } else {
      updated.rows = []
    }
    setDataset(updated)
  }

  const removeDatasetColumn = (colIndex: number) => {
    if (!dataset || !dataset.schema) return
    const updated = { ...dataset }
    updated.schema = updated.schema.filter((_: any, idx: number) => idx !== colIndex)
    if (updated.rows) {
      updated.rows = updated.rows.map((row: any[]) => row.filter((_: any, idx: number) => idx !== colIndex))
    }
    setDataset(updated)
  }

  const updateDatasetField = (field: string, value: any) => {
    if (!dataset) return
    setDataset({ ...dataset, [field]: value })
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

    if (!questionId) {
      alert('Question ID is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: any = {
        title,
        description,
        examples: examples.filter(ex => ex.input.trim() || ex.output.trim()),
        constraints: constraints.filter(c => c.trim()),
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        languages: ['python3'],
        starter_code: starterCode,
        library,
        requires_dataset: requiresDataset,
        is_published: isPublished,
      }

      // Add new format fields if they exist
      if (tasks.length > 0) {
        payload.tasks = tasks.filter(t => t.trim())
      }
      if (questionType) {
        payload.question_type = questionType
      }
      if (executionEnvironment) {
        payload.execution_environment = executionEnvironment
      }

      // Add assessment metadata
      payload.assessment_metadata = {
        skill: skill || library || 'Python',
        topic: topic || undefined,
        libraries: libraries.filter(l => l.trim()),
        selected_dataset_format: selectedDatasetFormat || 'csv'
      }

      // Add dataset if it exists
      if (dataset) {
        payload.dataset = dataset
      }

      // Keep legacy test cases for backward compatibility (if they exist)
      // But don't require them
      const question = questionData as any
      if (question.public_testcases && question.public_testcases.length > 0) {
        payload.public_testcases = question.public_testcases
      }
      if (question.hidden_testcases && question.hidden_testcases.length > 0) {
        payload.hidden_testcases = question.hidden_testcases
      }

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

          {/* Tasks (New Format) */}
          {aiGenerated && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Tasks</label>
                <button type="button" onClick={addTask} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                  + Add Task
                </button>
              </div>
              {tasks.map((task, idx) => (
                <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <textarea
                    value={task}
                    onChange={(e) => updateTask(idx, e.target.value)}
                    placeholder={`Task ${idx + 1}`}
                    rows={2}
                    style={{ flex: 1, padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem" }}
                  />
                  <button type="button" onClick={() => removeTask(idx)} style={{ color: "#DC2626", padding: "0.5rem 1rem" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Assessment Metadata (New Format) */}
          {aiGenerated && (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Skill</label>
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="e.g., Machine Learning, AI"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.375rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Classification, Regression"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.375rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontWeight: 600 }}>Libraries</label>
                  <button type="button" onClick={addLibrary} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                    + Add Library
                  </button>
                </div>
                {libraries.map((lib, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      value={lib}
                      onChange={(e) => updateLibrary(idx, e.target.value)}
                      placeholder="e.g., Scikit-learn, Pandas"
                      style={{ flex: 1, padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem" }}
                    />
                    <button type="button" onClick={() => removeLibrary(idx)} style={{ color: "#DC2626", padding: "0.5rem 1rem" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Dataset Format</label>
                <select
                  value={selectedDatasetFormat}
                  onChange={(e) => setSelectedDatasetFormat(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.375rem",
                  }}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="parquet">Parquet</option>
                  <option value="avro">Avro</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
            </>
          )}

          {/* Dataset Information - Editable Table */}
          {dataset && requiresDataset && (
            <div style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem", backgroundColor: "#F9FAFB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <label style={{ fontWeight: 600, fontSize: "1.1rem" }}>Dataset Information</label>
                <button
                  type="button"
                  onClick={() => setEditingDataset(!editingDataset)}
                  className="btn-secondary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                >
                  {editingDataset ? "📋 View Mode" : "✏️ Edit Dataset"}
                </button>
              </div>

              {/* Dataset Metadata */}
              <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#ffffff", borderRadius: "0.375rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>Source</label>
                    {editingDataset ? (
                      <select
                        value={dataset.source || 'synthetic'}
                        onChange={(e) => updateDatasetField('source', e.target.value)}
                        style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
                      >
                        <option value="synthetic">Synthetic</option>
                        <option value="sklearn">sklearn</option>
                        <option value="kaggle">Kaggle</option>
                      </select>
                    ) : (
                      <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>{dataset.source || 'N/A'}</div>
                    )}
                  </div>
                  {dataset.name && (
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>Dataset Name</label>
                      {editingDataset ? (
                        <input
                          type="text"
                          value={dataset.name || ''}
                          onChange={(e) => updateDatasetField('name', e.target.value)}
                          style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
                        />
                      ) : (
                        <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>{dataset.name}</div>
                      )}
                    </div>
                  )}
                </div>
                {dataset.load_code && (
                  <div>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>Load Code</label>
                    {editingDataset ? (
                      <textarea
                        value={dataset.load_code || ''}
                        onChange={(e) => updateDatasetField('load_code', e.target.value)}
                        rows={3}
                        style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem", fontFamily: "monospace", fontSize: "0.75rem" }}
                      />
                    ) : (
                      <pre style={{ marginTop: "0.25rem", padding: "0.5rem", backgroundColor: "#F9FAFB", borderRadius: "0.25rem", fontSize: "0.75rem", overflow: "auto" }}>
                        {dataset.load_code}
                      </pre>
                    )}
                  </div>
                )}
                {dataset.kaggle_url && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>Kaggle URL</label>
                    {editingDataset ? (
                      <input
                        type="text"
                        value={dataset.kaggle_url || ''}
                        onChange={(e) => updateDatasetField('kaggle_url', e.target.value)}
                        style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
                      />
                    ) : (
                      <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>{dataset.kaggle_url}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Schema Editor */}
              {dataset.schema && dataset.schema.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontWeight: 600 }}>Schema ({dataset.schema.length} columns)</label>
                    {editingDataset && (
                      <button
                        type="button"
                        onClick={addDatasetColumn}
                        className="btn-secondary"
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                      >
                        + Add Column
                      </button>
                    )}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff", borderRadius: "0.375rem", overflow: "hidden" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#F3F4F6" }}>
                          <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600 }}>Column Name</th>
                          <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600 }}>Type</th>
                          {editingDataset && (
                            <th style={{ padding: "0.5rem", textAlign: "center", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600, width: "80px" }}>Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.schema.map((col: any, colIdx: number) => (
                          <tr key={colIdx}>
                            <td style={{ padding: "0.5rem", border: "1px solid #E5E7EB" }}>
                              {editingDataset ? (
                                <input
                                  type="text"
                                  value={col.name || ''}
                                  onChange={(e) => updateDatasetSchema(colIdx, 'name', e.target.value)}
                                  style={{ width: "100%", padding: "0.375rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem", fontSize: "0.875rem" }}
                                />
                              ) : (
                                <span style={{ fontSize: "0.875rem" }}>{col.name}</span>
                              )}
                            </td>
                            <td style={{ padding: "0.5rem", border: "1px solid #E5E7EB" }}>
                              {editingDataset ? (
                                <select
                                  value={col.type || 'string'}
                                  onChange={(e) => updateDatasetSchema(colIdx, 'type', e.target.value)}
                                  style={{ width: "100%", padding: "0.375rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem", fontSize: "0.875rem" }}
                                >
                                  <option value="string">string</option>
                                  <option value="int">int</option>
                                  <option value="float">float</option>
                                  <option value="bool">bool</option>
                                </select>
                              ) : (
                                <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>{col.type}</span>
                              )}
                            </td>
                            {editingDataset && (
                              <td style={{ padding: "0.5rem", border: "1px solid #E5E7EB", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => removeDatasetColumn(colIdx)}
                                  style={{ color: "#DC2626", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Data Table */}
              {dataset.rows && dataset.rows.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontWeight: 600 }}>Data ({dataset.rows.length} rows)</label>
                    {editingDataset && (
                      <button
                        type="button"
                        onClick={addDatasetRow}
                        className="btn-secondary"
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.75rem" }}
                      >
                        + Add Row
                      </button>
                    )}
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: "0.375rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff" }}>
                      <thead style={{ position: "sticky", top: 0, backgroundColor: "#F3F4F6", zIndex: 10 }}>
                        <tr>
                          {dataset.schema?.map((col: any, colIdx: number) => (
                            <th key={colIdx} style={{ padding: "0.5rem", textAlign: "left", border: "1px solid #E5E7EB", fontSize: "0.75rem", fontWeight: 600, minWidth: "120px" }}>
                              {col.name}
                            </th>
                          ))}
                          {editingDataset && (
                            <th style={{ padding: "0.5rem", textAlign: "center", border: "1px solid #E5E7EB", fontSize: "0.75rem", fontWeight: 600, width: "80px" }}>Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.rows.map((row: any[], rowIdx: number) => (
                          <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#F9FAFB" }}>
                            {row.map((cell: any, colIdx: number) => (
                              <td key={colIdx} style={{ padding: "0.5rem", border: "1px solid #E5E7EB" }}>
                                {editingDataset ? (
                                  <input
                                    type="text"
                                    value={cell ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      // Try to convert based on column type
                                      const colType = dataset.schema[colIdx]?.type
                                      let convertedVal: any = val
                                      if (colType === 'int' && val !== '') {
                                        const num = parseInt(val)
                                        convertedVal = isNaN(num) ? val : num
                                      } else if (colType === 'float' && val !== '') {
                                        const num = parseFloat(val)
                                        convertedVal = isNaN(num) ? val : num
                                      } else if (colType === 'bool' && val !== '') {
                                        convertedVal = val.toLowerCase() === 'true' || val === '1'
                                      }
                                      updateDatasetRow(rowIdx, colIdx, convertedVal)
                                    }}
                                    style={{ width: "100%", padding: "0.375rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem", fontSize: "0.75rem" }}
                                  />
                                ) : (
                                  <span style={{ fontSize: "0.75rem", color: "#374151" }}>{String(cell ?? '')}</span>
                                )}
                              </td>
                            ))}
                            {editingDataset && (
                              <td style={{ padding: "0.5rem", border: "1px solid #E5E7EB", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => removeDatasetRow(rowIdx)}
                                  style={{ color: "#DC2626", fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

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




