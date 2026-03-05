import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { requireAuth } from '../../../../lib/auth';
import { useDataEngineeringQuestion, useUpdateDataEngineeringQuestion } from '@/hooks/api/useDataEngineering';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';

const DATA_ENGINEERING_TOPICS = [
  'transformations',
  'aggregations',
  'joins',
  'window_functions',
  'performance_optimization',
  'data_quality',
  'streaming'
];

const DATA_TYPES = ['string', 'int', 'float', 'bool', 'date', 'timestamp'];

export default function DataEngineeringQuestionEditPage() {
  const router = useRouter();
  const { id: questionId } = router.query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Question fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState(2);
  const [topic, setTopic] = useState('transformations');
  const [isPublished, setIsPublished] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  
  // Schema and test cases
  const [inputSchema, setInputSchema] = useState<Array<{column_name: string, data_type: string, description?: string}>>([]);
  const [sampleInputData, setSampleInputData] = useState<any>(null);
  const [expectedOutput, setExpectedOutput] = useState<any>(null);
  const [testCases, setTestCases] = useState<Array<{description: string, input_data: any, expected_output: any}>>([]);
  
  // Metadata
  const [experienceYears, setExperienceYears] = useState<number | undefined>(undefined);
  const [tools, setTools] = useState<string[]>([]);
  
  // Dataset editing state
  const [editingSchema, setEditingSchema] = useState(false);

  // React Query hook
  const { data: questionData, isLoading: loadingQuestion } = useDataEngineeringQuestion(questionId as string);
  const updateQuestionMutation = useUpdateDataEngineeringQuestion();
  
  // Update local state from React Query data
  useEffect(() => {
    if (questionData) {
      const question = questionData as any;
      
      setTitle(question.title || '');
      setDescription(question.problem_description || question.description || '');
      setDifficulty(question.difficulty_level || 2);
      setTopic(question.topic || 'transformations');
      setIsPublished(question.is_published || false);
      setAiGenerated(question.metadata?.ai_generated || false);
      
      // Schema and data
      setInputSchema(question.input_schema || []);
      setSampleInputData(question.sample_input_data || null);
      setExpectedOutput(question.expected_output || null);
      setTestCases(question.test_cases || []);
      
      // Metadata
      setExperienceYears(question.metadata?.experience_years);
      setTools(question.metadata?.tools || []);
      
      setLoading(false);
    }
  }, [questionData]);

  useEffect(() => {
    if (loadingQuestion !== undefined) {
      setLoading(loadingQuestion);
    }
  }, [loadingQuestion]);

  // Schema management
  const addSchemaColumn = () => {
    setInputSchema([...inputSchema, { column_name: '', data_type: 'string', description: '' }]);
  };

  const removeSchemaColumn = (idx: number) => {
    setInputSchema(inputSchema.filter((_, i) => i !== idx));
  };

  const updateSchemaColumn = (idx: number, field: string, value: string) => {
    const updated = [...inputSchema];
    updated[idx] = { ...updated[idx], [field]: value };
    setInputSchema(updated);
  };

  // Test case management
  const addTestCase = () => {
    setTestCases([...testCases, { description: '', input_data: { data: [] }, expected_output: { data: [] } }]);
  };

  const removeTestCase = (idx: number) => {
    setTestCases(testCases.filter((_, i) => i !== idx));
  };

  const updateTestCase = (idx: number, field: string, value: any) => {
    const updated = [...testCases];
    if (field === 'description') {
      updated[idx] = { ...updated[idx], description: value };
    } else if (field === 'input_data') {
      try {
        const parsed = JSON.parse(value);
        updated[idx] = { ...updated[idx], input_data: parsed };
      } catch (e) {
        // Keep as string if invalid JSON
      }
    } else if (field === 'expected_output') {
      try {
        const parsed = JSON.parse(value);
        updated[idx] = { ...updated[idx], expected_output: parsed };
      } catch (e) {
        // Keep as string if invalid JSON
      }
    }
    setTestCases(updated);
  };

  // Tools management
  const addTool = () => {
    setTools([...tools, '']);
  };

  const removeTool = (idx: number) => {
    setTools(tools.filter((_, i) => i !== idx));
  };

  const updateTool = (idx: number, value: string) => {
    const updated = [...tools];
    updated[idx] = value;
    setTools(updated);
  };

  const handleUpdate = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    if (!description.trim()) {
      alert('Description is required');
      return;
    }

    if (!questionId) {
      alert('Question ID is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        title,
        problem_description: description,
        difficulty_level: difficulty,
        topic,
        is_published: isPublished,
        input_schema: inputSchema.filter(col => col.column_name.trim()),
        sample_input_data: sampleInputData,
        expected_output: expectedOutput,
        test_cases: testCases.filter(tc => tc.description.trim()),
        metadata: {
          ai_generated: aiGenerated,
          experience_years: experienceYears,
          tools: tools.filter(t => t.trim()),
        },
      };

      await updateQuestionMutation.mutateAsync({
        questionId: questionId as string,
        data: payload,
      });
      alert('Question updated successfully!');
      router.push('/data-engineering/questions');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <Loader2 size={40} className="animate-spin" />
          <span style={{ fontWeight: 500 }}>Loading question...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFCFB", padding: "2rem 0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 1.5rem" }}>
        
        <div style={{ marginBottom: "2rem" }}>
          <button
            onClick={() => router.push("/data-engineering/questions")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              fontSize: "0.875rem",
              color: "#6B7280",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
            onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Questions
          </button>
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ 
            margin: "0 0 0.5rem 0", 
            color: "#111827",
            fontSize: "2.25rem",
            fontWeight: 800,
            letterSpacing: "-0.025em"
          }}>
            Edit Data Engineering Question
          </h1>
          <p style={{ 
            color: "#6B7280", 
            fontSize: "1rem",
            margin: 0
          }}>
            Update question details, schema, and test cases
          </p>
        </div>

        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          padding: "2.5rem",
          marginBottom: "4rem"
        }}>

          {error && (
            <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "0.5rem", borderLeft: "4px solid #DC2626", fontSize: "0.9rem" }}>
              {error}
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
              Title <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Question title"
              style={{
                width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                borderRadius: "0.5rem", fontSize: "0.95rem", transition: "all 0.2s ease",
                outline: "none", boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#D1D5DB";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
              Problem Description <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem and requirements..."
              style={{
                width: "100%", padding: "1rem", border: "1px solid #D1D5DB",
                borderRadius: "0.5rem", minHeight: "180px", fontSize: "0.95rem", 
                fontFamily: "inherit", resize: "vertical", transition: "all 0.2s ease",
                outline: "none", boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#D1D5DB";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Difficulty and Topic */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                Difficulty <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value))}
                style={{
                  width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                  cursor: "pointer", transition: "all 0.2s ease", outline: "none"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
              >
                <option value={1}>Easy</option>
                <option value={2}>Medium</option>
                <option value={3}>Hard</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                Topic <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{
                  width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                  cursor: "pointer", transition: "all 0.2s ease", outline: "none"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
              >
                {DATA_ENGINEERING_TOPICS.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Input Schema */}
          <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #E5E7EB", borderRadius: "0.75rem", backgroundColor: "#F9FAFB" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <label style={{ fontWeight: 600, fontSize: "1.1rem", color: "#111827" }}>Input Schema</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setEditingSchema(!editingSchema)}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#ffffff",
                    border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#374151"
                  }}
                >
                  {editingSchema ? "📋 View Mode" : "✏️ Edit Schema"}
                </button>
                {editingSchema && (
                  <button
                    type="button"
                    onClick={addSchemaColumn}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#00684A",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem"
                    }}
                  >
                    <Plus size={16} /> Add Column
                  </button>
                )}
              </div>
            </div>

            {inputSchema.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F3F4F6" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600 }}>Column Name</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600 }}>Data Type</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600 }}>Description</th>
                      {editingSchema && (
                        <th style={{ padding: "0.75rem", textAlign: "center", border: "1px solid #E5E7EB", fontSize: "0.875rem", fontWeight: 600, width: "100px" }}>Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {inputSchema.map((col, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "0.75rem", border: "1px solid #E5E7EB" }}>
                          {editingSchema ? (
                            <input
                              type="text"
                              value={col.column_name}
                              onChange={(e) => updateSchemaColumn(idx, 'column_name', e.target.value)}
                              placeholder="Column name"
                              style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.875rem" }}
                            />
                          ) : (
                            <span style={{ fontSize: "0.875rem", fontFamily: "monospace" }}>{col.column_name}</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", border: "1px solid #E5E7EB" }}>
                          {editingSchema ? (
                            <select
                              value={col.data_type}
                              onChange={(e) => updateSchemaColumn(idx, 'data_type', e.target.value)}
                              style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.875rem" }}
                            >
                              {DATA_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: "0.875rem", color: "#6366F1", fontFamily: "monospace" }}>{col.data_type}</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", border: "1px solid #E5E7EB" }}>
                          {editingSchema ? (
                            <input
                              type="text"
                              value={col.description || ''}
                              onChange={(e) => updateSchemaColumn(idx, 'description', e.target.value)}
                              placeholder="Optional description"
                              style={{ width: "100%", padding: "0.5rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.875rem" }}
                            />
                          ) : (
                            <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>{col.description || '-'}</span>
                          )}
                        </td>
                        {editingSchema && (
                          <td style={{ padding: "0.75rem", border: "1px solid #E5E7EB", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeSchemaColumn(idx)}
                              style={{ color: "#DC2626", fontSize: "0.875rem", padding: "0.375rem 0.75rem", backgroundColor: "transparent", border: "none", cursor: "pointer" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280", backgroundColor: "#ffffff", borderRadius: "0.5rem", border: "1px dashed #D1D5DB" }}>
                No schema columns defined. Click "Add Column" to start.
              </div>
            )}
          </div>

          {/* Sample Input Data */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
              Sample Input Data (JSON)
            </label>
            <textarea
              value={sampleInputData ? JSON.stringify(sampleInputData, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setSampleInputData(parsed);
                } catch (err) {
                  // Keep as string if invalid JSON
                }
              }}
              placeholder='{"data": [[...]]}'
              rows={8}
              style={{
                width: "100%", padding: "1rem", border: "1px solid #D1D5DB",
                borderRadius: "0.5rem", fontSize: "0.875rem", 
                fontFamily: "monospace", resize: "vertical", transition: "all 0.2s ease",
                outline: "none", boxSizing: "border-box", backgroundColor: "#F9FAFB"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#D1D5DB";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Expected Output */}
          <div style={{ marginBottom: "2rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
              Expected Output (JSON)
            </label>
            <textarea
              value={expectedOutput ? JSON.stringify(expectedOutput, null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setExpectedOutput(parsed);
                } catch (err) {
                  // Keep as string if invalid JSON
                }
              }}
              placeholder='{"data": [[...]]}'
              rows={8}
              style={{
                width: "100%", padding: "1rem", border: "1px solid #D1D5DB",
                borderRadius: "0.5rem", fontSize: "0.875rem", 
                fontFamily: "monospace", resize: "vertical", transition: "all 0.2s ease",
                outline: "none", boxSizing: "border-box", backgroundColor: "#F0FDF4"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#D1D5DB";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Test Cases */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <label style={{ fontWeight: 600, fontSize: "1.1rem", color: "#111827" }}>Test Cases</label>
              <button
                type="button"
                onClick={addTestCase}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#00684A",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem"
                }}
              >
                <Plus size={16} /> Add Test Case
              </button>
            </div>

            {testCases.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {testCases.map((tc, idx) => (
                  <div key={idx} style={{ padding: "1.5rem", border: "1px solid #E5E7EB", borderRadius: "0.75rem", backgroundColor: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span style={{ fontWeight: 600, color: "#111827" }}>Test Case {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeTestCase(idx)}
                        style={{ color: "#DC2626", fontSize: "0.875rem", padding: "0.375rem 0.75rem", backgroundColor: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                    
                    <div style={{ marginBottom: "1rem" }}>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={tc.description}
                        onChange={(e) => updateTestCase(idx, 'description', e.target.value)}
                        placeholder="Describe this test case..."
                        style={{ width: "100%", padding: "0.625rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.875rem" }}
                      />
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                          Input Data (JSON)
                        </label>
                        <textarea
                          value={JSON.stringify(tc.input_data, null, 2)}
                          onChange={(e) => updateTestCase(idx, 'input_data', e.target.value)}
                          rows={6}
                          style={{ width: "100%", padding: "0.625rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.75rem", fontFamily: "monospace", backgroundColor: "#F9FAFB" }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                          Expected Output (JSON)
                        </label>
                        <textarea
                          value={JSON.stringify(tc.expected_output, null, 2)}
                          onChange={(e) => updateTestCase(idx, 'expected_output', e.target.value)}
                          rows={6}
                          style={{ width: "100%", padding: "0.625rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.75rem", fontFamily: "monospace", backgroundColor: "#F0FDF4" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280", backgroundColor: "#ffffff", borderRadius: "0.5rem", border: "1px dashed #D1D5DB" }}>
                No test cases defined. Click "Add Test Case" to start.
              </div>
            )}
          </div>

          {/* Metadata Section */}
          <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #E5E7EB", borderRadius: "0.75rem", backgroundColor: "#F9FAFB" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontWeight: 600, fontSize: "1.1rem", color: "#111827" }}>Metadata</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  Experience Level (years)
                </label>
                <input
                  type="number"
                  value={experienceYears || ''}
                  onChange={(e) => setExperienceYears(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="e.g., 5"
                  min="0"
                  max="20"
                  style={{
                    width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem", fontSize: "0.95rem", transition: "all 0.2s ease",
                    outline: "none", boxSizing: "border-box", backgroundColor: "#ffffff"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <label style={{ fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  Tools/Technologies
                </label>
                <button
                  type="button"
                  onClick={addTool}
                  style={{
                    padding: "0.375rem 0.75rem",
                    backgroundColor: "#ffffff",
                    border: "1px solid #D1D5DB",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    color: "#374151"
                  }}
                >
                  <Plus size={14} /> Add Tool
                </button>
              </div>
              {tools.map((tool, idx) => (
                <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    value={tool}
                    onChange={(e) => updateTool(idx, e.target.value)}
                    placeholder="e.g., Spark, Pandas, SQL"
                    style={{ flex: 1, padding: "0.625rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", fontSize: "0.875rem", backgroundColor: "#ffffff" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeTool(idx)}
                    style={{ color: "#DC2626", padding: "0.625rem", backgroundColor: "transparent", border: "none", cursor: "pointer" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #E5E7EB", borderRadius: "0.75rem", backgroundColor: "#F9FAFB" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontWeight: 600, fontSize: "1.1rem", color: "#111827" }}>Publishing Options</h3>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#00684A" }}
              />
              <span style={{ fontWeight: 600, color: "#111827", fontSize: "0.95rem" }}>
                Published (visible to candidates)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ 
            display: "flex", gap: "1rem", paddingTop: "1.5rem", borderTop: "1px solid #E5E7EB" 
          }}>
            <button
              type="button"
              onClick={() => router.push("/data-engineering/questions")}
              style={{ 
                flex: 1, padding: "0.875rem", fontSize: "1rem", fontWeight: 600, color: "#374151",
                backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem",
                cursor: "pointer", transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              style={{ 
                flex: 2, padding: "0.875rem", fontSize: "1rem", fontWeight: 600, color: "#ffffff",
                backgroundColor: "#00684A", border: "none", borderRadius: "0.5rem",
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { if(!saving) e.currentTarget.style.backgroundColor = "#084A2A" }}
              onMouseLeave={(e) => { if(!saving) e.currentTarget.style.backgroundColor = "#00684A" }}
            >
              {saving ? (
                <><Loader2 size={18} className="animate-spin" /> Saving...</>
              ) : (
                <><Save size={18} /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
