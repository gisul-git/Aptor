import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import { useCreateAIMLQuestion } from '@/hooks/api/useAIML'
import { aimlService } from '@/services/aiml'

const AIML_SKILLS = [
  'Python',
  'AI',
  'Machine Learning',
  'Deep Learning',
  'Data Science'
]

const SKILL_TOPICS: Record<string, string[]> = {
  'Python': [
    'Basic Python',
    'NumPy',
    'Data Structures',
    'Functions',
    'Object-Oriented Programming',
    'File Handling',
    'Error Handling',
    'List Comprehensions',
    'Generators',
    'Decorators',
    'Context Managers',
    'Multithreading',
    'Regular Expressions'
  ],
  'AI': [
    'Natural Language Processing',
    'Computer Vision',
    'Expert Systems',
    'Search Algorithms',
    'Game AI',
    'Robotics',
    'Knowledge Representation',
    'Planning',
    'Reasoning',
    'Agent Systems'
  ],
  'Machine Learning': [
    'Classification',
    'Regression',
    'Clustering',
    'Feature Engineering',
    'Model Evaluation',
    'Cross-Validation',
    'Hyperparameter Tuning',
    'Ensemble Methods',
    'Dimensionality Reduction',
    'Data Preprocessing',
    'Model Selection',
    'Bias-Variance Tradeoff',
    'Overfitting Prevention'
  ],
  'Deep Learning': [
    'Neural Networks',
    'Convolutional Neural Networks (CNN)',
    'Recurrent Neural Networks (RNN)',
    'Long Short-Term Memory (LSTM)',
    'Transformers',
    'Transfer Learning',
    'Autoencoders',
    'Generative Adversarial Networks (GAN)',
    'Backpropagation',
    'Optimization Algorithms',
    'Regularization Techniques',
    'Model Architecture Design'
  ],
  'Data Science': [
    'Data Analysis',
    'Data Visualization',
    'Data Preprocessing',
    'Statistical Analysis',
    'Exploratory Data Analysis',
    'Data Cleaning',
    'Feature Selection',
    'Time Series Analysis',
    'Hypothesis Testing',
    'Data Wrangling',
    'Pandas',
    'Matplotlib',
    'Seaborn'
  ]
}

const DATASET_FORMATS = ['csv', 'json', 'pdf', 'parquet', 'avro']

const DEFAULT_PYTHON_STARTER = `import numpy as np
# Your code here
`

type Testcase = {
  input: string
  expected_output: string
}

export default function AIMLQuestionCreatePage() {
  const router = useRouter()
  const createQuestionMutation = useCreateAIMLQuestion()
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Question type toggle
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  
  // AI Generation fields (NEW FORMAT)
  const [assessmentTitle, setAssessmentTitle] = useState('')
  const [skill, setSkill] = useState('Python')
  const [topic, setTopic] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [datasetFormat, setDatasetFormat] = useState('csv')
  
  // AI-suggested topics
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [topicsError, setTopicsError] = useState<string | null>(null)
  
  // Track if it's the initial mount and if AI generation is active
  const isInitialMount = useRef(true)
  const previousSkill = useRef<string | null>(null)
  const previousDifficulty = useRef<string | null>(null)

  // Fetch AI-suggested topics when skill or difficulty changes (only for AI generation mode)
  // Only fetch when user explicitly changes skill/difficulty, NOT on initial mount or mode switch
  useEffect(() => {
    // Skip on initial mount - don't fetch topics for pre-set values
    if (isInitialMount.current) {
      isInitialMount.current = false
      previousSkill.current = skill
      previousDifficulty.current = aiDifficulty
      // Don't fetch topics on initial mount, even if skill/difficulty are pre-set
      return
    }
    
    // Only fetch if AI generation mode is active
    if (!isAiGenerated) {
      // Clear topics if switching away from AI generation
      setAvailableTopics([])
      setTopic('')
      return
    }
    
    // Only fetch if skill or difficulty actually changed (user explicitly changed them)
    if (previousSkill.current === skill && previousDifficulty.current === aiDifficulty) {
      return
    }
    
    // Update previous values
    previousSkill.current = skill
    previousDifficulty.current = aiDifficulty
    
    if (!skill) {
      setAvailableTopics([])
      setTopic('')
      return
    }
    
    const fetchTopics = async () => {
      setLoadingTopics(true)
      setTopicsError(null)
      setTopic('') // Reset topic when fetching new suggestions
      
      try {
        const response = await aimlService.suggestTopics({
          skill: skill,
          difficulty: aiDifficulty
        })
        
        if (response.data && response.data.topics) {
          setAvailableTopics(response.data.topics)
    } else {
          // Fallback to static topics if API fails
          setAvailableTopics(SKILL_TOPICS[skill] || [])
        }
      } catch (err: any) {
        console.error('Error fetching topic suggestions:', err)
        setTopicsError('Failed to load topic suggestions')
        // Fallback to static topics
        setAvailableTopics(SKILL_TOPICS[skill] || [])
      } finally {
        setLoadingTopics(false)
      }
    }
    
    fetchTopics()
  }, [skill, aiDifficulty, isAiGenerated])
  
  // Clear topics when switching away from AI generation mode
  useEffect(() => {
    if (!isAiGenerated) {
      // Clear topics when switching away from AI generation
      setAvailableTopics([])
      setTopic('')
    }
    // Do NOT auto-fetch topics when switching TO AI generation mode
    // Topics should only be fetched when user explicitly changes skill or difficulty
  }, [isAiGenerated])

  // Handle skill change - reset topic when skill changes
  const handleSkillChange = (newSkill: string) => {
    setSkill(newSkill)
    setTopic('') // Reset topic when skill changes
  }
  
  // Handle difficulty change
  const handleDifficultyChange = (newDifficulty: string) => {
    setAiDifficulty(newDifficulty)
    setTopic('') // Reset topic when difficulty changes
  }
  
  // Manual question fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tasks, setTasks] = useState<string[]>([''])
  const [difficulty, setDifficulty] = useState('medium')
  const [manualDatasetFormat, setManualDatasetFormat] = useState('csv')
  const [requiresDataset, setRequiresDataset] = useState(false)
  const [datasetFile, setDatasetFile] = useState<File | null>(null)

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

  const handleAiGenerate = async () => {
    if (!assessmentTitle.trim()) {
      alert('Please provide an assessment title')
      return
    }

    if (!skill) {
      alert('Please select a skill')
      return
    }

    if (!aiDifficulty) {
      alert('Please select a difficulty')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      // Call backend with new format parameters
      const response = await aimlService.generateAIQuestion({
        title: assessmentTitle,
        skill: skill,
        topic: topic.trim() || undefined,
        difficulty: aiDifficulty,
        dataset_format: datasetFormat,
      })

      const data = response.data
      
      // Handle new response format
      if (data.assessment && data.question) {
        // New format response
        const assessment = data.assessment
        const question = data.question
      
      // Populate form with generated question
        setTitle(assessment.title || assessmentTitle)
      setDescription(question.description || '')
        setDifficulty(assessment.difficulty || aiDifficulty)
        
        // If tasks are provided, convert to description or display separately
        if (question.tasks && question.tasks.length > 0) {
          const tasksText = question.tasks.map((task: string, idx: number) => `${idx + 1}. ${task}`).join('\n\n')
          setDescription(prev => prev ? `${prev}\n\nTasks:\n${tasksText}` : `Tasks:\n${tasksText}`)
        }
        
        // Note: New format doesn't include testcases in the same way
        // The question is already saved by the backend
        setRequiresDataset(data.dataset !== null && data.dataset !== undefined)
        
        // Show success and redirect
      alert('Question generated and saved successfully!')
      router.push('/aiml/questions')
      } else {
        // Legacy format response (backward compatibility)
        setTitle(data.title || assessmentTitle)
        setDescription(data.description || '')
        setDifficulty(data.difficulty || aiDifficulty)
        setRequiresDataset(false)
        alert('Question generated and saved successfully!')
        router.push('/aiml/questions')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || 'Failed to generate question')
      alert(err.response?.data?.detail || 'Failed to generate question')
    } finally {
      setGenerating(false)
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('Title is required')
      return
    }

    if (!description.trim()) {
      alert('Description is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: any = {
        title,
        description,
        tasks: tasks.filter(t => t.trim()),
        constraints: [],
        difficulty: 'medium',
        languages: ['python3'],
        public_testcases: [],
        hidden_testcases: [],
        starter_code: { python3: DEFAULT_PYTHON_STARTER },
        library: 'numpy',
        requires_dataset: requiresDataset,
        ai_generated: false,
        is_published: false,
        question_type: 'aiml_coding',
        execution_environment: 'jupyter_notebook',
        assessment_metadata: {
          skill: 'Python',
          topic: undefined,
          libraries: [],
          selected_dataset_format: manualDatasetFormat
        }
      }
      
      // Handle dataset file upload if provided
      if (requiresDataset && datasetFile) {
        // For now, we'll handle dataset separately or convert it
        // The backend will need to handle file uploads
        // For manual creation, we can create dataset from file
        const formData = new FormData()
        formData.append('file', datasetFile)
        // Note: This would need a separate endpoint to upload and parse dataset
        // For now, we'll just set requires_dataset flag
      }

      await createQuestionMutation.mutateAsync(payload)
      alert('Question created successfully!')
      router.push('/aiml/questions')
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || 'Failed to create question')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", padding: "2rem 0" }}>
      <div className="container" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <button
            onClick={() => router.push("/aiml/questions")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.9375rem",
              backgroundColor: "transparent",
              border: "1px solid #A8E8BC",
              borderRadius: "0.5rem",
              color: "#1E5A3B",
              cursor: "pointer",
              transition: "all 0.2s ease",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#E8FAF0"
              e.currentTarget.style.borderColor = "#9DE8B0"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.borderColor = "#A8E8BC"
            }}
          >
            ← Back to Questions
          </button>
        </div>

        <div className="card" style={{ boxShadow: "0 4px 16px rgba(201, 244, 212, 0.15)" }}>
          <div style={{ marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "2px solid #E8FAF0" }}>
            <h1 style={{ 
              marginBottom: "0.5rem", 
              color: "#1E5A3B",
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>
              Create AIML Question
            </h1>
            <p style={{ 
              color: "#4A9A6A", 
              fontSize: "0.9375rem",
              margin: 0
            }}>
              Generate questions using AI or create them manually
            </p>
          </div>

          {/* Question Type Toggle */}
          <div style={{ 
            marginBottom: "2.5rem", 
            padding: "1.5rem", 
            border: "2px solid #E8FAF0", 
            borderRadius: "0.75rem",
            backgroundColor: "#f9fafb"
          }}>
            <label style={{ 
              display: "block", 
              marginBottom: "1rem", 
              fontWeight: 600,
              color: "#1E5A3B",
              fontSize: "1rem"
            }}>
              Question Type
            </label>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "0.75rem", 
                cursor: "pointer",
                padding: "0.75rem 1.25rem",
                borderRadius: "0.5rem",
                border: !isAiGenerated ? "2px solid #C9F4D4" : "2px solid transparent",
                backgroundColor: !isAiGenerated ? "#E8FAF0" : "transparent",
                transition: "all 0.2s ease",
                flex: 1,
                justifyContent: "center"
              }}>
                <input
                  type="radio"
                  checked={!isAiGenerated}
                  onChange={() => setIsAiGenerated(false)}
                  style={{ 
                    width: "18px", 
                    height: "18px",
                    cursor: "pointer"
                  }}
                />
                <span style={{ 
                  fontWeight: !isAiGenerated ? 600 : 500,
                  color: "#1E5A3B"
                }}>
                  Manual Creation
                </span>
              </label>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "0.75rem", 
                cursor: "pointer",
                padding: "0.75rem 1.25rem",
                borderRadius: "0.5rem",
                border: isAiGenerated ? "2px solid #C9F4D4" : "2px solid transparent",
                backgroundColor: isAiGenerated ? "#E8FAF0" : "transparent",
                transition: "all 0.2s ease",
                flex: 1,
                justifyContent: "center"
              }}>
                <input
                  type="radio"
                  checked={isAiGenerated}
                  onChange={() => setIsAiGenerated(true)}
                  style={{ 
                    width: "18px", 
                    height: "18px",
                    cursor: "pointer"
                  }}
                />
                <span style={{ 
                  fontWeight: isAiGenerated ? 600 : 500,
                  color: "#1E5A3B"
                }}>
                  AI Generated
                </span>
              </label>
            </div>
          </div>

          {isAiGenerated ? (
            /* AI Generation Form - NEW FORMAT */
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ 
                marginBottom: "2rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #E8FAF0"
              }}>
                <h2 style={{ 
                  marginBottom: "0.5rem", 
                  color: "#1E5A3B",
                  fontSize: "1.5rem",
                  fontWeight: 600
                }}>
                  AI Question Generation
                </h2>
                <p style={{ 
                  color: "#4A9A6A", 
                  fontSize: "0.875rem",
                  margin: 0
                }}>
                  Let AI generate a comprehensive question based on your requirements
                </p>
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: "1.5rem",
                marginBottom: "1.5rem"
              }}>
                <div>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.625rem", 
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.9375rem"
                  }}>
                    Assessment Title <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={assessmentTitle}
                    onChange={(e) => setAssessmentTitle(e.target.value)}
                    placeholder="Enter assessment title"
                    style={{
                      width: "100%",
                      padding: "0.875rem 1rem",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      fontSize: "0.9375rem",
                      transition: "all 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#9DE8B0"
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#A8E8BC"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.625rem", 
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.9375rem"
                  }}>
                    Skill <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                    value={skill}
                    onChange={(e) => handleSkillChange(e.target.value)}
                  style={{
                    width: "100%",
                      padding: "0.875rem 1rem",
                    border: "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      fontSize: "0.9375rem",
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#9DE8B0"
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#A8E8BC"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  >
                    {AIML_SKILLS.map(s => (
                      <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#1E5A3B",
                  fontSize: "0.9375rem"
                }}>
                  Difficulty <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => handleDifficultyChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#9DE8B0"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#A8E8BC"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#1E5A3B",
                  fontSize: "0.9375rem"
                }}>
                  Topic
                  {loadingTopics && (
                    <span style={{ 
                      marginLeft: "0.5rem", 
                      color: "#4A9A6A", 
                      fontSize: "0.875rem", 
                      fontWeight: "normal" 
                    }}>
                      (Loading AI suggestions...)
                    </span>
                  )}
                </label>
                {loadingTopics ? (
                  <div style={{ 
                    padding: "2rem", 
                    border: "1px solid #A8E8BC", 
                    borderRadius: "0.5rem",
                    backgroundColor: "#f9fafb",
                    textAlign: "center",
                    color: "#4A9A6A"
                  }}>
                    <div style={{ marginBottom: "0.5rem" }}>⏳</div>
                    Loading AI-suggested topics...
                  </div>
                ) : (
                  <div style={{
                    padding: "1rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    minHeight: "120px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    backgroundColor: "#ffffff"
                  }}>
                    {availableTopics.length > 0 ? (
                      <div style={{ 
                        display: "flex", 
                        flexWrap: "wrap", 
                        gap: "0.75rem" 
                      }}>
                        {availableTopics.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTopic(topic === t ? '' : t)}
                            style={{
                              padding: "0.625rem 1.25rem",
                              border: topic === t ? "2px solid #C9F4D4" : "1px solid #A8E8BC",
                              borderRadius: "0.5rem",
                              backgroundColor: topic === t ? "#E8FAF0" : "#ffffff",
                              color: topic === t ? "#1E5A3B" : "#2D7A52",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              fontWeight: topic === t ? 600 : 500,
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (topic !== t) {
                                e.currentTarget.style.backgroundColor = "#E8FAF0"
                                e.currentTarget.style.borderColor = "#C9F4D4"
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (topic !== t) {
                                e.currentTarget.style.backgroundColor = "#ffffff"
                                e.currentTarget.style.borderColor = "#A8E8BC"
                              }
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ 
                        color: "#4A9A6A", 
                        textAlign: "center", 
                        padding: "2rem 1rem",
                        fontSize: "0.875rem"
                      }}>
                        No topics available. Please select a skill and difficulty.
                      </div>
                    )}
                  </div>
                )}
                {topicsError && (
                  <small style={{ 
                    color: "#DC2626", 
                    fontSize: "0.875rem", 
                    display: "block", 
                    marginTop: "0.5rem" 
                  }}>
                    {topicsError} (Using fallback topics)
                  </small>
                )}
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#1E5A3B",
                  fontSize: "0.9375rem"
                }}>
                  Dataset Format <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  value={datasetFormat}
                  onChange={(e) => setDatasetFormat(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#9DE8B0"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#A8E8BC"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                >
                  {DATASET_FORMATS.map(format => (
                    <option key={format} value={format}>{format.toUpperCase()}</option>
                  ))}
                </select>
                <small style={{ 
                  color: "#4A9A6A", 
                  fontSize: "0.8125rem",
                  display: "block",
                  marginTop: "0.5rem"
                }}>
                  💡 The AI will generate the dataset in JSON format, which will then be automatically converted to the selected format ({datasetFormat.toUpperCase()}) when candidates access it.
                </small>
              </div>

              <div style={{ 
                paddingTop: "1.5rem",
                borderTop: "1px solid #E8FAF0"
              }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAiGenerate}
                disabled={generating}
                  style={{ 
                    width: "100%",
                    padding: "0.875rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: 600
                  }}
                >
                  {generating ? "⏳ Generating..." : "🤖 Generate Question with AI"}
              </button>
              {error && (
                  <div style={{ 
                    marginTop: "1rem", 
                    padding: "1rem", 
                    backgroundColor: "#FEE2E2", 
                    color: "#DC2626", 
                    borderRadius: "0.5rem",
                    borderLeft: "4px solid #DC2626"
                  }}>
                  {error}
                </div>
              )}
              </div>
            </div>
          ) : (
            /* Manual Creation Form */
            <>
              <div style={{ 
                marginBottom: "2rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #E8FAF0"
              }}>
                <h2 style={{ 
                  marginBottom: "0.5rem", 
                  color: "#1E5A3B",
                  fontSize: "1.5rem",
                  fontWeight: 600
                }}>
                  Manual Question Creation
                </h2>
                <p style={{ 
                  color: "#4A9A6A", 
                  fontSize: "0.875rem",
                  margin: 0
                }}>
                  Create a question manually with full control over the content
                </p>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#1E5A3B",
                  fontSize: "0.9375rem"
                }}>
                  Title <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Normalize Array using NumPy"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#9DE8B0"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#A8E8BC"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#1E5A3B",
                  fontSize: "0.9375rem"
                }}>
                  Question Description <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem in detail..."
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    minHeight: "150px",
                    fontSize: "0.9375rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#9DE8B0"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#A8E8BC"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#1E5A3B",
                  fontSize: "0.9375rem"
                }}>
                  Tasks
                </label>
                <div style={{
                  border: "1px solid #E8FAF0",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  backgroundColor: "#f9fafb"
                }}>
                  {tasks.map((task, idx) => (
                    <div key={idx} style={{ 
                      display: "flex", 
                      gap: "0.75rem", 
                      marginBottom: "0.75rem",
                      alignItems: "center"
                    }}>
                      <div style={{
                        minWidth: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#C9F4D4",
                        color: "#1E5A3B",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </div>
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => updateTask(idx, e.target.value)}
                        placeholder={`Enter task ${idx + 1}...`}
                  style={{
                          flex: 1,
                          padding: "0.75rem 1rem",
                    border: "1px solid #A8E8BC",
                          borderRadius: "0.5rem",
                          fontSize: "0.9375rem",
                          transition: "all 0.2s ease",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#9DE8B0"
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#A8E8BC"
                          e.currentTarget.style.boxShadow = "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeTask(idx)}
                        style={{
                          padding: "0.625rem 1rem",
                          backgroundColor: "#DC2626",
                          color: "white",
                          border: "none",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          transition: "all 0.2s ease",
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#B91C1C"
                          e.currentTarget.style.transform = "scale(1.05)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#DC2626"
                          e.currentTarget.style.transform = "scale(1)"
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTask}
                    className="btn-secondary"
                    style={{ 
                      marginTop: "0.5rem",
                      width: "100%",
                      padding: "0.75rem 1rem"
                    }}
                  >
                    + Add Task
                  </button>
                </div>
              </div>

              <div style={{ 
                marginBottom: "2rem",
                padding: "1.5rem",
                border: "1px solid #E8FAF0",
                borderRadius: "0.5rem",
                backgroundColor: "#f9fafb"
              }}>
                <label style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "0.75rem", 
                  cursor: "pointer",
                  marginBottom: requiresDataset ? "1rem" : "0"
                }}>
                  <input
                    type="checkbox"
                    checked={requiresDataset}
                    onChange={(e) => setRequiresDataset(e.target.checked)}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer"
                    }}
                  />
                  <span style={{ 
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.9375rem"
                  }}>
                    This question requires a dataset
                  </span>
                </label>
                {requiresDataset && (
                  <div style={{ 
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid #E8FAF0"
                  }}>
                    <div style={{ marginBottom: "1rem" }}>
                      <label style={{ 
                        display: "block", 
                        marginBottom: "0.625rem", 
                        fontWeight: 600, 
                        fontSize: "0.9375rem",
                        color: "#1E5A3B"
                      }}>
                        Dataset Format <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <select
                        value={manualDatasetFormat}
                        onChange={(e) => setManualDatasetFormat(e.target.value)}
                      style={{
                        width: "100%",
                          padding: "0.875rem 1rem",
                        border: "1px solid #A8E8BC",
                          borderRadius: "0.5rem",
                          fontSize: "0.9375rem",
                          backgroundColor: "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#9DE8B0"
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 244, 212, 0.2)"
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#A8E8BC"
                          e.currentTarget.style.boxShadow = "none"
                        }}
                      >
                        {DATASET_FORMATS.map(format => (
                          <option key={format} value={format}>{format.toUpperCase()}</option>
                        ))}
                      </select>
                  </div>
                    <div>
                      <label style={{ 
                        display: "block", 
                        marginBottom: "0.625rem", 
                        fontWeight: 600, 
                        fontSize: "0.9375rem",
                        color: "#1E5A3B"
                      }}>
                        Upload Dataset File
                </label>
                      <input
                        type="file"
                        accept=".csv,.json,.xlsx"
                        onChange={(e) => setDatasetFile(e.target.files?.[0] || null)}
                  style={{
                    width: "100%",
                          padding: "0.875rem 1rem",
                    border: "1px solid #A8E8BC",
                          borderRadius: "0.5rem",
                          fontSize: "0.9375rem",
                          backgroundColor: "#ffffff",
                          cursor: "pointer",
                        }}
                      />
                      <small style={{ 
                        color: "#4A9A6A", 
                        fontSize: "0.8125rem", 
                        display: "block", 
                        marginTop: "0.5rem" 
                      }}>
                        Upload a dataset file (CSV, JSON, or Excel). The dataset will be converted to the selected format.
                      </small>
              </div>
                  </div>
                )}
              </div>

            </>
          )}

          {error && (
            <div style={{ 
              marginBottom: "1.5rem", 
              padding: "1rem", 
              backgroundColor: "#FEE2E2", 
              color: "#DC2626", 
              borderRadius: "0.5rem",
              borderLeft: "4px solid #DC2626"
            }}>
              {error}
            </div>
          )}

          {!isAiGenerated && (
            <div style={{ 
              display: "flex", 
              gap: "1rem", 
              marginTop: "2rem",
              paddingTop: "2rem",
              borderTop: "2px solid #E8FAF0"
            }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/aiml/questions")}
                style={{ 
                  flex: 1,
                  padding: "0.875rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: 600
                }}
            >
              Cancel
            </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={saving}
                style={{ 
                  flex: 1,
                  padding: "0.875rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: 600
                }}
              >
                {saving ? "⏳ Creating..." : "Create Question"}
              </button>
            </div>
            )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
