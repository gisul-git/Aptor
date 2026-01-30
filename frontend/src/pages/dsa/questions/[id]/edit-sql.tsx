'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/dsa/ui/card'
import { Button } from '../../../../components/dsa/ui/button'
import { Input } from '../../../../components/dsa/ui/input'
import { Textarea } from '../../../../components/dsa/ui/textarea'
import dsaApi from '../../../../lib/dsa/api'
import { Database, Table2, Loader2 } from 'lucide-react'

type TableSchema = {
  columns: Record<string, string>
}

const SQL_CATEGORIES = [
  { value: 'select', label: 'SELECT Queries' },
  { value: 'join', label: 'JOIN Operations' },
  { value: 'aggregation', label: 'Aggregation' },
  { value: 'subquery', label: 'Subqueries' },
  { value: 'window', label: 'Window Functions' },
]

export default function SQLEditPage() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [isPublished, setIsPublished] = useState(false)
  const [sqlCategory, setSqlCategory] = useState('select')
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({})
  const [sampleData, setSampleData] = useState<Record<string, any[][]>>({})
  const [starterQuery, setStarterQuery] = useState('')
  const [referenceQuery, setReferenceQuery] = useState('')
  const [sqlExpectedOutput, setSqlExpectedOutput] = useState('')
  const [constraints, setConstraints] = useState<string[]>([''])
  const [hints, setHints] = useState<string[]>([''])
  const [orderSensitive, setOrderSensitive] = useState(false)

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

      // Verify this is an SQL question
      if (data.question_type !== 'SQL') {
        router.push(`/dsa/questions/${questionId}/edit`)
        return
      }

      // Populate form fields
      setTitle(data.title || '')
      setDescription(data.description || '')
      setDifficulty(data.difficulty || 'medium')
      setIsPublished(data.is_published || false)
      setSqlCategory(data.sql_category || 'select')
      setSchemas(data.schemas || {})
      setSampleData(data.sample_data || {})
      setStarterQuery(data.starter_query || '-- Write your SQL query here\n\nSELECT ')
      setReferenceQuery(data.reference_query || '')
      setSqlExpectedOutput(data.sql_expected_output || '')
      setConstraints(data.constraints && data.constraints.length > 0 ? data.constraints : [''])
      setHints(data.hints && data.hints.length > 0 ? data.hints : [''])
      setOrderSensitive(data.evaluation?.order_sensitive || false)
    } catch (err: any) {
      console.error('Error loading question:', err)
      setError(err.response?.data?.detail || 'Failed to load question')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        title,
        description,
        difficulty,
        question_type: 'SQL',
        sql_category: sqlCategory,
        schemas,
        sample_data: sampleData,
        constraints: constraints.filter((c) => c.trim()),
        starter_query: starterQuery,
        reference_query: referenceQuery.trim() || null,
        sql_expected_output: sqlExpectedOutput.trim() || null,
        hints: hints.filter((h) => h.trim()),
        evaluation: {
          engine: 'postgres',
          comparison: 'result_set',
          order_sensitive: orderSensitive,
        },
        is_published: isPublished,
      }

      await dsaApi.put(`/questions/${id}`, payload)
      router.push('/dsa/questions')
    } catch (err: any) {
      console.error('Error updating question:', err)
      setError(err.response?.data?.detail || 'Failed to update question')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading SQL question...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href="/dsa/questions">
            <Button variant="outline">
              ← Back to Questions
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-4xl font-bold">Edit SQL Question</h1>
          <p className="text-muted-foreground mt-1">Edit SQL question details</p>
        </div>

        {error && (
          <Card className="mb-6 border-red-500">
            <CardContent className="p-4">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Employee Salary Analysis"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe the business problem and what data needs to be retrieved..."
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">SQL Category</label>
                <select
                  value={sqlCategory}
                  onChange={(e) => setSqlCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {SQL_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                <span className="text-sm">Published</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* SQL Query Fields */}
        <Card className="mb-6 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              SQL Queries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Starter Query</label>
              <Textarea
                value={starterQuery}
                onChange={(e) => setStarterQuery(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                placeholder="-- Write your SQL query here\n\nSELECT "
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reference Query (Correct Answer)</label>
              <Textarea
                value={referenceQuery}
                onChange={(e) => setReferenceQuery(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                placeholder="SELECT * FROM table WHERE condition;"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Expected Output (Optional)</label>
              <Textarea
                value={sqlExpectedOutput}
                onChange={(e) => setSqlExpectedOutput(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                placeholder="Optional: Manual expected result snapshot (JSON format). If provided, this will be used for evaluation instead of executing the reference query."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional manual expected result snapshot. If provided, this will be used for evaluation instead of executing the reference query.
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={orderSensitive}
                  onChange={(e) => setOrderSensitive(e.target.checked)}
                />
                <span className="text-sm">Order Sensitive (row order matters for evaluation)</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Table Schemas */}
        <Card className="mb-6 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-blue-400" />
              Table Schemas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(schemas).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No schemas defined</p>
            ) : (
              Object.entries(schemas).map(([tableName, schema]) => (
                <div key={tableName} className="border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-medium text-blue-400">{tableName}</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(schema.columns).map(([colName, colType]) => (
                      <div key={colName} className="text-sm text-muted-foreground">
                        <span className="font-mono">{colName}</span>: <span className="font-mono">{colType}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Constraints */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Constraints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {constraints.map((constraint, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={constraint}
                  onChange={(e) => {
                    const newConstraints = [...constraints]
                    newConstraints[idx] = e.target.value
                    setConstraints(newConstraints)
                  }}
                  placeholder="e.g., Results must be ordered by salary DESC"
                  className="font-mono text-sm flex-1"
                />
                {constraints.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => setConstraints(constraints.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConstraints([...constraints, ''])}
            >
              + Add Constraint
            </Button>
          </CardContent>
        </Card>

        {/* Hints */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Hints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hints.map((hint, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={hint}
                  onChange={(e) => {
                    const newHints = [...hints]
                    newHints[idx] = e.target.value
                    setHints(newHints)
                  }}
                  placeholder="e.g., Use JOIN to combine tables"
                  className="flex-1"
                />
                {hints.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => setHints(hints.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHints([...hints, ''])}
            >
              + Add Hint
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/dsa/questions">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleUpdate} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update SQL Question'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

