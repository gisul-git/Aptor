import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import { useCreateAIMLQuestion, useGenerateAIMLQuestion } from '@/hooks/api/useAIML'
import { aimlService } from '@/services/aiml'
import { 
  ArrowLeft, 
  Bot, 
  PenTool, 
  Sparkles, 
  Loader2, 
  Plus, 
  Trash2, 
  Check, 
  Database,
  BookOpen
} from 'lucide-react'

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
  const generateAIQuestionMutation = useGenerateAIMLQuestion()
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
      console.log('🟡 [Create Page] Starting fetchTopics:', {
        skill,
        aiDifficulty,
        isAiGenerated,
        timestamp: new Date().toISOString(),
      });
      
      setLoadingTopics(true)
      setTopicsError(null)
      setTopic('') // Reset topic when fetching new suggestions
      
      try {
        console.log('🟡 [Create Page] Calling aimlService.suggestTopics...');
        const response = await aimlService.suggestTopics({
          skill: skill,
          difficulty: aiDifficulty
        })
        
        console.log('🟢 [Create Page] suggestTopics response received:', {
          hasResponse: !!response,
          hasData: !!response.data,
          hasTopics: !!response.data?.topics,
          topicsCount: response.data?.topics?.length || 0,
          response: response,
        });
        
        if (response.data && response.data.topics) {
          console.log('🟢 [Create Page] Setting available topics:', response.data.topics);
          setAvailableTopics(response.data.topics)
        } else {
          console.warn('⚠️ [Create Page] Response missing topics, using fallback');
          // Fallback to static topics if API fails
          setAvailableTopics(SKILL_TOPICS[skill] || [])
        }
      } catch (err: any) {
        console.error('🔴 [Create Page] Error fetching topic suggestions:', {
          error: err,
          message: err?.message,
          code: err?.code,
          status: err?.response?.status,
          statusText: err?.response?.statusText,
          responseData: err?.response?.data,
          stack: err?.stack,
          errorType: err?.constructor?.name,
        });
        setTopicsError('Failed to load topic suggestions')
        // Fallback to static topics
        setAvailableTopics(SKILL_TOPICS[skill] || [])
      } finally {
        setLoadingTopics(false)
        console.log('🟡 [Create Page] fetchTopics completed');
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
      // Use React Query mutation hook for proper cache invalidation
      const response = await generateAIQuestionMutation.mutateAsync({
        title: assessmentTitle,
        skill: skill,
        topic: topic.trim() || undefined,
        difficulty: aiDifficulty,
        dataset_format: datasetFormat,
      })

      console.log('🟢 [Create Page] generateAIQuestion response:', {
        response: response,
        hasAssessment: !!response?.assessment,
        hasQuestion: !!response?.question,
        responseKeys: response ? Object.keys(response) : [],
      })

      // The mutation returns the data directly (GenerateAIQuestionResponse)
      const data = response
      
      // Validate data exists
      if (!data) {
        throw new Error('No data received from server')
      }
      
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
        // Cache invalidation happens automatically via the mutation hook
        alert('Question generated and saved successfully!')
        router.push('/aiml/questions')
      } else {
        // Fallback: if response doesn't have expected structure
        console.warn('Unexpected response format:', data)
        setTitle(assessmentTitle)
        setDescription('')
        setDifficulty(aiDifficulty)
        setRequiresDataset(false)
        alert('Question generated but response format was unexpected. Please check the question in the list.')
        router.push('/aiml/questions')
      }
    } catch (err: any) {
      console.error(err)
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to generate question'
      setError(errorMessage)
      alert(errorMessage)
    } finally {
      setGenerating(false)
    }
  }

  // Helper function to parse CSV file and convert to dataset format
  const parseCSVToDataset = (file: File): Promise<{ schema: Array<{ name: string; type: string }>; rows: any[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          console.log('🔵 [AIML Create] CSV file read, parsing...', {
            fileSize: text.length,
            firstChars: text.substring(0, 200),
          })
          
          const lines = text.split('\n').filter(line => line.trim())
          if (lines.length < 2) {
            reject(new Error('CSV must have at least a header row and one data row'))
            return
          }
          
          // Robust CSV parser that handles quoted fields properly
          const parseCsvLine = (line: string): string[] => {
            const result: string[] = []
            let current = ''
            let inQuotes = false
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              const nextChar = i < line.length - 1 ? line[i + 1] : null
              
              if (char === '"') {
                // Handle escaped quotes ("")
                if (inQuotes && nextChar === '"') {
                  current += '"'
                  i++ // Skip next quote
                } else {
                  inQuotes = !inQuotes
                }
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim())
                current = ''
              } else {
                current += char
              }
            }
            // Add the last field
            result.push(current.trim())
            return result
          }
          
          // Parse header
          const header = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
          console.log('🔵 [AIML Create] CSV header parsed:', {
            headerCount: header.length,
            headers: header,
          })
          
          // Infer types from first data row
          const firstDataRow = parseCsvLine(lines[1])
          const schema = header.map((name, idx) => {
            const value = firstDataRow[idx] || ''
            let type = 'string' // default
            
            // Try to infer type
            if (value !== '') {
              // Check if it's a number
              if (!isNaN(Number(value)) && value.trim() !== '') {
                type = value.includes('.') ? 'float' : 'int'
              } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                type = 'bool'
              }
            }
            
            return { name, type }
          })
          
          console.log('🔵 [AIML Create] Schema inferred:', schema)
          
          // Parse all data rows
          const rows: any[][] = []
          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i])
            // Ensure row has same number of columns as header
            const row = header.map((_, idx) => {
              const val = values[idx] || ''
              // Convert based on schema type
              const colType = schema[idx]?.type || 'string'
              if (colType === 'int' && val !== '') {
                const num = parseInt(val)
                return isNaN(num) ? val : num
              } else if (colType === 'float' && val !== '') {
                const num = parseFloat(val)
                return isNaN(num) ? val : num
              } else if (colType === 'bool' && val !== '') {
                return val.toLowerCase() === 'true'
              }
              return val
            })
            rows.push(row)
          }
          
          console.log('🟢 [AIML Create] CSV parsed successfully:', {
            schemaCount: schema.length,
            rowCount: rows.length,
            firstRow: rows[0],
          })
          
          resolve({ schema, rows })
        } catch (error: any) {
          console.error('🔴 [AIML Create] Error parsing CSV:', error)
          reject(error)
        }
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsText(file)
    })
  }

  const handleCreate = async () => {
    console.log('🔵 [AIML Create] handleCreate called')
    
    if (!title.trim()) {
      alert('Title is required')
      return
    }

    if (!description.trim()) {
      alert('Description is required')
      return
    }

    console.log('🔵 [AIML Create] Validation passed, preparing payload...', {
      title,
      hasDescription: !!description,
      requiresDataset,
      hasDatasetFile: !!datasetFile,
      datasetFileName: datasetFile?.name,
      datasetFileSize: datasetFile?.size,
      manualDatasetFormat,
    })

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
        console.log('🟢 [AIML Create] Dataset file detected, parsing CSV...', {
          fileName: datasetFile.name,
          fileSize: datasetFile.size,
          fileType: datasetFile.type,
        })
        
        try {
          // Parse CSV file to dataset format
          const dataset = await parseCSVToDataset(datasetFile)
          console.log('🟢 [AIML Create] Dataset parsed successfully:', {
            schemaCount: dataset.schema.length,
            rowCount: dataset.rows.length,
            schema: dataset.schema,
          })
          
          // Add dataset to payload with format
          payload.dataset = {
            ...dataset,
            format: manualDatasetFormat
          }
          
          console.log('🟢 [AIML Create] Dataset added to payload:', {
            hasDataset: !!payload.dataset,
            schemaCount: payload.dataset.schema.length,
            rowCount: payload.dataset.rows.length,
            format: payload.dataset.format,
          })
        } catch (parseError: any) {
          console.error('🔴 [AIML Create] Error parsing dataset file:', parseError)
          alert(`Failed to parse dataset file: ${parseError.message}`)
          setSaving(false)
          return
        }
      } else {
        console.log('🟡 [AIML Create] Dataset handling:', {
          requiresDataset,
          hasDatasetFile: !!datasetFile,
          message: requiresDataset && !datasetFile 
            ? 'WARNING: requires_dataset is true but no file uploaded!' 
            : 'No dataset required or no file provided',
        })
      }
      
      console.log('🔵 [AIML Create] Payload prepared:', {
        ...payload,
        tasksCount: payload.tasks.length,
        hasAssessmentMetadata: !!payload.assessment_metadata,
        selectedFormat: payload.assessment_metadata.selected_dataset_format,
        hasDataset: !!payload.dataset,
      })

      console.log('🟢 [AIML Create] Sending payload to backend:', {
        payloadKeys: Object.keys(payload),
        hasDatasetInPayload: 'dataset' in payload,
        requiresDataset: payload.requires_dataset,
        datasetInfo: payload.dataset ? {
          schemaCount: payload.dataset.schema?.length,
          rowCount: payload.dataset.rows?.length,
          format: payload.dataset.format,
        } : null,
      })

      await createQuestionMutation.mutateAsync(payload)
      console.log('🟢 [AIML Create] Question created successfully!')
      alert('Question created successfully!')
      router.push('/aiml/questions')
    } catch (err: any) {
      console.error('🔴 [AIML Create] Error creating question:', {
        error: err,
        message: err?.message,
        response: err?.response,
        status: err?.response?.status,
        data: err?.response?.data,
      })
      setError(err.response?.data?.detail || 'Failed to create question')
    } finally {
      setSaving(false)
      console.log('🔵 [AIML Create] handleCreate completed')
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFCFB", padding: "2rem 0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            onClick={() => router.push("/aiml")}
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
            <ArrowLeft size={16} strokeWidth={2.5} />AIML Dashboard
          </button>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ 
            margin: "0 0 0.5rem 0", 
            color: "#111827",
            fontSize: "2.25rem",
            fontWeight: 800,
            letterSpacing: "-0.025em"
          }}>
            Create AIML Question
          </h1>
          <p style={{ 
            color: "#6B7280", 
            fontSize: "1rem",
            margin: 0
          }}>
            Create new questions manually or generate them instantly using AI.
          </p>
        </div>

        {/* Question Type Toggle (Segmented Control) */}
        <div style={{ 
          marginBottom: "2rem", 
          padding: "0.5rem", 
          borderRadius: "0.75rem",
          backgroundColor: "#F3F4F6",
          display: "flex",
          gap: "0.5rem"
        }}>
          <button
            type="button"
            onClick={() => setIsAiGenerated(false)}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: "0.5rem", 
              cursor: "pointer",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: !isAiGenerated ? "#ffffff" : "transparent",
              boxShadow: !isAiGenerated ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s ease",
              flex: 1,
              color: !isAiGenerated ? "#00684A" : "#6B7280",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            <PenTool size={18} strokeWidth={!isAiGenerated ? 2.5 : 2} />
            Manual Creation
          </button>
          
          <button
            type="button"
            onClick={() => setIsAiGenerated(true)}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: "0.5rem", 
              cursor: "pointer",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: isAiGenerated ? "#ffffff" : "transparent",
              boxShadow: isAiGenerated ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s ease",
              flex: 1,
              color: isAiGenerated ? "#00684A" : "#6B7280",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            <Sparkles size={18} strokeWidth={isAiGenerated ? 2.5 : 2} />
            AI Generated
          </button>
        </div>

        {/* Content Area */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          padding: "2.5rem",
          marginBottom: "4rem"
        }}>

          {isAiGenerated ? (
            /* AI Generation Form */
            <div>
              <div style={{ 
                marginBottom: "2rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem"
              }}>
                <div style={{ backgroundColor: "#F0F9F4", padding: "0.5rem", borderRadius: "0.5rem", color: "#00684A" }}>
                  <Bot size={24} />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 0.25rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>
                    AI Configuration
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.875rem", margin: 0 }}>
                    Provide the parameters, and AI will build the question structure.
                  </p>
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Assessment Title <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={assessmentTitle}
                    onChange={(e) => setAssessmentTitle(e.target.value)}
                    placeholder="e.g., NumPy Data Normalization"
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", transition: "all 0.2s ease",
                      outline: "none", boxSizing: "border-box"
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#00684A"
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#D1D5DB"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Skill Domain <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={skill}
                    onChange={(e) => handleSkillChange(e.target.value)}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                      cursor: "pointer", transition: "all 0.2s ease", outline: "none"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  >
                    {AIML_SKILLS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Difficulty Level <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => handleDifficultyChange(e.target.value)}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                      cursor: "pointer", transition: "all 0.2s ease", outline: "none"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    <span>Specific Topic Focus</span>
                    {loadingTopics && (
                      <span style={{ color: "#6B7280", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Loader2 size={12} className="animate-spin" /> Fetching AI suggestions...
                      </span>
                    )}
                  </label>
                  
                  {loadingTopics ? (
                    <div style={{ padding: "2rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: "#F9FAFB", display: "flex", justifyContent: "center", alignItems: "center", color: "#6B7280" }}>
                      <Loader2 size={24} className="animate-spin" />
                    </div>
                  ) : (
                    <div style={{
                      padding: "1.25rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem",
                      backgroundColor: "#F9FAFB", maxHeight: "240px", overflowY: "auto"
                    }}>
                      {availableTopics.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                          {availableTopics.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTopic(topic === t ? '' : t)}
                              style={{
                                padding: "0.5rem 1rem",
                                border: topic === t ? "2px solid #00684A" : "1px solid #D1D5DB",
                                borderRadius: "2rem",
                                backgroundColor: topic === t ? "#F0F9F4" : "#ffffff",
                                color: topic === t ? "#00684A" : "#4B5563",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: topic === t ? 600 : 500,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                if (topic !== t) { e.currentTarget.style.borderColor = "#9CA3AF" }
                              }}
                              onMouseLeave={(e) => {
                                if (topic !== t) { e.currentTarget.style.borderColor = "#D1D5DB" }
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: "#6B7280", textAlign: "center", padding: "1rem", fontSize: "0.875rem" }}>
                          No topics available. Please select a skill and difficulty.
                        </div>
                      )}
                    </div>
                  )}
                  {topicsError && (
                    <p style={{ color: "#DC2626", fontSize: "0.75rem", margin: "0.5rem 0 0 0" }}>
                      {topicsError} (Using fallback topics)
                    </p>
                  )}
                </div>

                <div style={{ gridColumn: "1 / -1", paddingTop: "1.5rem", borderTop: "1px solid #E5E7EB" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Expected Dataset Format <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={datasetFormat}
                    onChange={(e) => setDatasetFormat(e.target.value)}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                      cursor: "pointer", transition: "all 0.2s ease", outline: "none",
                      marginBottom: "0.5rem"
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#00684A"
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#D1D5DB"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  >
                    {DATASET_FORMATS.map(format => (
                      <option key={format} value={format}>{format.toUpperCase()}</option>
                    ))}
                  </select>
                  <p style={{ color: "#6B7280", fontSize: "0.8rem", margin: 0, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Database size={14} /> The AI will generate data in JSON and convert it to {datasetFormat.toUpperCase()} for the candidate.
                  </p>
                </div>
              </div>

              {error && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "0.5rem", borderLeft: "4px solid #DC2626", fontSize: "0.9rem" }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: "2rem" }}>
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={generating}
                  style={{ 
                    width: "100%", padding: "1rem", backgroundColor: "#00684A", color: "#ffffff",
                    border: "none", borderRadius: "0.5rem", fontSize: "1rem", fontWeight: 600,
                    cursor: generating ? "not-allowed" : "pointer", opacity: generating ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => { if(!generating) e.currentTarget.style.backgroundColor = "#084A2A" }}
                  onMouseOut={(e) => { if(!generating) e.currentTarget.style.backgroundColor = "#00684A" }}
                >
                  {generating ? (
                    <><Loader2 size={18} className="animate-spin" /> Generating Magic...</>
                  ) : (
                    <><Sparkles size={18} /> Generate Question</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Manual Creation Form */
            <div>
              <div style={{ 
                marginBottom: "2rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem"
              }}>
                <div style={{ backgroundColor: "#F0F9F4", padding: "0.5rem", borderRadius: "0.5rem", color: "#00684A" }}>
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 0.25rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>
                    Question Details
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.875rem", margin: 0 }}>
                    Manually author the problem statement and structure.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  Title <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Normalize Array using NumPy"
                  style={{
                    width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem", fontSize: "0.95rem", transition: "all 0.2s ease",
                    outline: "none", boxSizing: "border-box"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#00684A"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#D1D5DB"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  Problem Description <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, the required inputs, and expected outputs..."
                  style={{
                    width: "100%", padding: "1rem", border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem", minHeight: "180px", fontSize: "0.95rem", 
                    fontFamily: "inherit", resize: "vertical", transition: "all 0.2s ease",
                    outline: "none", boxSizing: "border-box"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#00684A"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#D1D5DB"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  <span>Tasks/Steps</span>
                </label>
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem", padding: "1.25rem", backgroundColor: "#F9FAFB" }}>
                  {tasks.map((task, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", alignItems: "flex-start" }}>
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#E1F2E9",
                        color: "#00684A", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.75rem", fontWeight: 700, flexShrink: 0, marginTop: "0.2rem"
                      }}>
                        {idx + 1}
                      </div>
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => updateTask(idx, e.target.value)}
                        placeholder="Define a specific task or step..."
                        style={{
                          flex: 1, padding: "0.6rem 1rem", border: "1px solid #D1D5DB",
                          borderRadius: "0.5rem", fontSize: "0.95rem", outline: "none",
                          transition: "border 0.2s"
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                      />
                      <button
                        type="button"
                        onClick={() => removeTask(idx)}
                        style={{
                          padding: "0.6rem", backgroundColor: "transparent", color: "#EF4444",
                          border: "1px solid transparent", borderRadius: "0.5rem", cursor: "pointer",
                          transition: "all 0.2s", marginTop: "0.1rem"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FEE2E2"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        title="Remove task"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTask}
                    style={{ 
                      marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.6rem 1rem", backgroundColor: "white", border: "1px dashed #D1D5DB",
                      borderRadius: "0.5rem", color: "#4B5563", fontSize: "0.875rem", fontWeight: 600,
                      cursor: "pointer", transition: "all 0.2s", width: "100%", justifyContent: "center"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#00684A"
                      e.currentTarget.style.color = "#00684A"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#D1D5DB"
                      e.currentTarget.style.color = "#4B5563"
                    }}
                  >
                    <Plus size={16} /> Add Another Task
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #E5E7EB", borderRadius: "0.75rem", backgroundColor: "#F9FAFB" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={requiresDataset}
                    onChange={(e) => setRequiresDataset(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#00684A" }}
                  />
                  <span style={{ fontWeight: 600, color: "#111827", fontSize: "0.95rem" }}>
                    This question requires a dataset attachment
                  </span>
                </label>
                
                {requiresDataset && (
                  <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid #E5E7EB" }}>
                    <div style={{ marginBottom: "1.25rem" }}>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}>
                        Candidate Dataset Format <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <select
                        value={manualDatasetFormat}
                        onChange={(e) => setManualDatasetFormat(e.target.value)}
                        style={{
                          width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                          borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                          cursor: "pointer", outline: "none"
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                      >
                        {DATASET_FORMATS.map(format => (
                          <option key={format} value={format}>{format.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}>
                        Upload Source Dataset <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="file"
                        accept=".csv,.json,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          setDatasetFile(file)
                        }}
                        style={{
                          width: "100%", padding: "0.6rem", border: "1px dashed #A8E8BC",
                          borderRadius: "0.5rem", fontSize: "0.9rem", backgroundColor: "#ffffff",
                          cursor: "pointer", color: "#4B5563"
                        }}
                      />
                      <p style={{ color: "#6B7280", fontSize: "0.8rem", margin: "0.5rem 0 0 0" }}>
                        Upload a CSV, JSON, or Excel file. It will be converted to your chosen format above.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#FEE2E2", color: "#DC2626", borderRadius: "0.5rem", borderLeft: "4px solid #DC2626", fontSize: "0.9rem" }}>
                  {error}
                </div>
              )}

              <div style={{ 
                display: "flex", gap: "1rem", paddingTop: "1.5rem", borderTop: "1px solid #E5E7EB" 
              }}>
                <button
                  type="button"
                  onClick={() => router.push("/aiml/questions")}
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
                  onClick={handleCreate}
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
                    <><Check size={18} /> Save Manual Question</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth