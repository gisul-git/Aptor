import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'

const DESIGN_ROLES = [
  { value: 'ui_designer', label: 'UI Designer' },
  { value: 'ux_designer', label: 'UX Designer' },
  { value: 'product_designer', label: 'Product Designer' },
  { value: 'visual_designer', label: 'Visual Designer' },
]

const TASK_TYPES = [
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'component', label: 'Component' },
]

const DIFFICULTY_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const EXPERIENCE_LEVELS = [
  { value: 'fresher', label: 'Fresher' },
  { value: '1-3 years', label: '1-3 years' },
  { value: '3-5 years', label: '3-5 years' },
  { value: 'senior', label: 'Senior' },
]

// Helper function to convert years to experience level string
const getExperienceLevelFromYears = (years: number): string => {
  if (years === 0) return 'fresher'
  if (years <= 3) return '1-3 years'
  if (years <= 5) return '3-5 years'
  return 'senior'
}

export default function DesignQuestionCreatePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Question type toggle
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  
  // AI Generation fields
  const [aiRole, setAiRole] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('intermediate')
  const [aiExperienceYears, setAiExperienceYears] = useState(3)
  const [aiTaskType, setAiTaskType] = useState('')
  const [taskTypeSuggestions, setTaskTypeSuggestions] = useState<string[]>([])
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null)
  const [manualTaskType, setManualTaskType] = useState('')
  const [openRequirements, setOpenRequirements] = useState('')
  
  // Manual question fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState('')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [taskType, setTaskType] = useState('')
  const [constraints, setConstraints] = useState<string[]>([''])
  const [deliverables, setDeliverables] = useState<string[]>([''])
  const [evaluationCriteria, setEvaluationCriteria] = useState<string[]>([''])
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60)

  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3007/api/v1/design'

  // Auto-load suggestions when role, difficulty, and experience are all set
  useEffect(() => {
    if (aiRole && aiDifficulty && isAiGenerated) {
      loadTaskTypeSuggestions()
    }
  }, [aiRole, aiDifficulty, aiExperienceYears, isAiGenerated])

  // Load task type suggestions when role, difficulty, and experience are selected
  const loadTaskTypeSuggestions = async () => {
    if (!aiRole || !aiDifficulty) {
      return
    }

    setLoadingSuggestions(true)
    setError(null)

    try {
      const roleMap: Record<string, string> = {
        'ui': 'ui_designer',
        'ux': 'ux_designer',
        'product': 'product_designer',
        'visual': 'visual_designer',
        'interaction': 'interaction_designer',
        'ui designer': 'ui_designer',
        'ux designer': 'ux_designer',
        'product designer': 'product_designer',
        'visual designer': 'visual_designer',
        'interaction designer': 'interaction_designer',
      }
      
      const normalizedRole = roleMap[aiRole.toLowerCase()] || 'ui_designer'
      
      const response = await fetch(`${API_URL}/questions/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: normalizedRole,
          difficulty: aiDifficulty,
          experience_years: aiExperienceYears,
          task_type: 'dashboard', // Default, will be replaced by suggestions
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to load task type suggestions')
      }

      const data = await response.json()
      setTaskTypeSuggestions(data.suggestions || [])
      setSelectedTaskType(null)
      setAiTaskType('')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load task type suggestions')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Auto-load suggestions when role, difficulty, and experience are set
  const handleFieldChange = (field: string, value: string | number) => {
    switch (field) {
      case 'role':
        setAiRole(value as string)
        break
      case 'difficulty':
        setAiDifficulty(value as string)
        break
      case 'experience':
        setAiExperienceYears(value as number)
        break
    }
  }

  const selectTaskType = (taskType: string) => {
    setSelectedTaskType(taskType)
    setAiTaskType(taskType)
    setManualTaskType('') // Clear manual input when selecting suggestion
  }

  const handleManualTaskType = (value: string) => {
    setManualTaskType(value)
    setAiTaskType(value)
    setSelectedTaskType(null) // Clear selection when typing manually
  }

  const addConstraint = () => setConstraints([...constraints, ''])
  const removeConstraint = (idx: number) => setConstraints(constraints.filter((_, i) => i !== idx))
  const updateConstraint = (idx: number, value: string) => {
    const updated = [...constraints]
    updated[idx] = value
    setConstraints(updated)
  }

  const addDeliverable = () => setDeliverables([...deliverables, ''])
  const removeDeliverable = (idx: number) => setDeliverables(deliverables.filter((_, i) => i !== idx))
  const updateDeliverable = (idx: number, value: string) => {
    const updated = [...deliverables]
    updated[idx] = value
    setDeliverables(updated)
  }

  const addCriteria = () => setEvaluationCriteria([...evaluationCriteria, ''])
  const removeCriteria = (idx: number) => setEvaluationCriteria(evaluationCriteria.filter((_, i) => i !== idx))
  const updateCriteria = (idx: number, value: string) => {
    const updated = [...evaluationCriteria]
    updated[idx] = value
    setEvaluationCriteria(updated)
  }

  const handleAiGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      // Convert role and task_type to backend format
      const roleMap: Record<string, string> = {
        'ui': 'ui_designer',
        'ux': 'ux_designer',
        'product': 'product_designer',
        'visual': 'visual_designer',
        'interaction': 'interaction_designer',
        'ui designer': 'ui_designer',
        'ux designer': 'ux_designer',
        'product designer': 'product_designer',
        'visual designer': 'visual_designer',
        'interaction designer': 'interaction_designer',
      }
      
      // Extract task type from topic name
      // Topics like "Fitness tracking dashboard" -> "dashboard"
      // Topics like "Recipe discovery mobile app" -> "mobile_app"
      const extractTaskType = (topic: string): string => {
        const topicLower = topic.toLowerCase()
        
        // Check for keywords in the topic (order matters - most specific first)
        // Dashboard indicators (check FIRST since it's most specific)
        if (topicLower.includes('dashboard') || topicLower.includes('analytics')) {
          return 'dashboard'
        }
        // Landing page indicators
        else if (topicLower.includes('landing') || topicLower.includes('website') || topicLower.includes('page')) {
          return 'landing_page'
        }
        // Component indicators
        else if (topicLower.includes('component') || topicLower.includes('library') || topicLower.includes('system')) {
          return 'component'
        }
        // Brand work
        else if (topicLower.includes('brand') || topicLower.includes('logo') || topicLower.includes('identity')) {
          return 'component'
        }
        // Mobile app indicators - check for app-related keywords
        // This includes: mobile, app, onboarding, checkout, booking, scheduler, manager, tracker, etc.
        else if (topicLower.includes('mobile') || 
            topicLower.includes('app') || 
            topicLower.includes('onboarding') ||
            topicLower.includes('checkout') ||
            topicLower.includes('booking') ||
            topicLower.includes('scheduler') ||
            topicLower.includes('manager') ||
            topicLower.includes('tracker') ||
            topicLower.includes('delivery') ||
            topicLower.includes('subscription') ||
            topicLower.includes('appointment') ||
            topicLower.includes('fitness') ||
            topicLower.includes('banking') ||
            topicLower.includes('social') ||
            topicLower.includes('entertainment')) {
          return 'mobile_app'
        }
        // UX work
        else if (topicLower.includes('wireframe') || topicLower.includes('flow') || topicLower.includes('research')) {
          return 'mobile_app'
        }
        
        // Default to mobile_app for UI-related topics
        return 'mobile_app'
      }
      
      const normalizedRole = roleMap[aiRole.toLowerCase()] || 'ui_designer'
      const normalizedTaskType = extractTaskType(aiTaskType)
      const experienceLevel = getExperienceLevelFromYears(aiExperienceYears)
      
      const response = await fetch(`${API_URL}/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: normalizedRole,
          difficulty: aiDifficulty,
          experience_level: experienceLevel,
          task_type: normalizedTaskType,
          topic: aiTaskType.trim() || undefined,
          open_requirements: openRequirements.trim() || undefined,
          created_by: 'system',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to generate question')
      }

      const data = await response.json()
      
      // Navigate to questions list after successful generation
      alert('Question generated successfully!')
      router.push('/design/questions')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to generate question')
      alert(err.message || 'Failed to generate question')
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
      // Convert role and task_type to backend format
      const roleMap: Record<string, string> = {
        'ui': 'ui_designer',
        'ux': 'ux_designer',
        'product': 'product_designer',
        'visual': 'visual_designer',
        'ui designer': 'ui_designer',
        'ux designer': 'ux_designer',
        'product designer': 'product_designer',
        'visual designer': 'visual_designer',
        'graphic designer': 'visual_designer',
        'brand designer': 'visual_designer',
        'interaction designer': 'ui_designer',
        'brand design': 'visual_designer',
        'graphic design': 'visual_designer',
      }
      
      const taskTypeMap: Record<string, string> = {
        'landing page': 'landing_page',
        'mobile app': 'mobile_app',
        'dashboard': 'dashboard',
        'component': 'component',
        'website': 'landing_page',
        'web app': 'mobile_app',
        'e-commerce': 'landing_page',
        'ecommerce': 'landing_page',
        'onboarding flow': 'mobile_app',
        'user flow': 'mobile_app',
        'landing': 'landing_page',
      }
      
      const normalizedRole = roleMap[role.toLowerCase()] || 'ui_designer'
      const normalizedTaskType = taskTypeMap[taskType.toLowerCase()] || 'landing_page'
      
      const payload = {
        title,
        description,
        role: normalizedRole,
        difficulty,
        experience_level: experienceLevel || undefined,
        task_type: normalizedTaskType,
        constraints: constraints.filter(c => c.trim()),
        deliverables: deliverables.filter(d => d.trim()),
        evaluation_criteria: evaluationCriteria.filter(e => e.trim()),
        time_limit_minutes: timeLimitMinutes,
        created_by: 'system',
        ai_generated: isAiGenerated,
        is_published: false,
      }

      const response = await fetch(`${API_URL}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to create question')
      }

      alert('Question created successfully!')
      router.push('/design/questions')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to create question')
      alert(err.message || 'Failed to create question')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", padding: "2rem 0" }}>
      <div className="container" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div className="card" style={{ boxShadow: "0 4px 16px rgba(232, 180, 250, 0.15)" }}>
          <div style={{ marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "2px solid #F3E8FF" }}>
            <h1 style={{ 
              marginBottom: 0, 
              color: "#7C3AED",
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>
              Create Design Question
            </h1>
          </div>

          {/* Question Type Toggle */}
          <div style={{ 
            marginBottom: "2.5rem", 
            padding: "1.5rem", 
            border: "2px solid #F3E8FF", 
            borderRadius: "0.75rem",
            backgroundColor: "#f9fafb"
          }}>
            <label style={{ 
              display: "block", 
              marginBottom: "1rem", 
              fontWeight: 600,
              color: "#7C3AED",
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
                border: !isAiGenerated ? "2px solid #E8B4FA" : "2px solid transparent",
                backgroundColor: !isAiGenerated ? "#F3E8FF" : "transparent",
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
                  color: "#7C3AED"
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
                border: isAiGenerated ? "2px solid #E8B4FA" : "2px solid transparent",
                backgroundColor: isAiGenerated ? "#F3E8FF" : "transparent",
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
                  color: "#7C3AED"
                }}>
                  AI Generated
                </span>
              </label>
            </div>
          </div>

          {isAiGenerated ? (
            /* AI Generation Form */
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ 
                marginBottom: "2rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #F3E8FF"
              }}>
                <h2 style={{ 
                  marginBottom: 0, 
                  color: "#7C3AED",
                  fontSize: "1.5rem",
                  fontWeight: 600
                }}>
                  AI Question Generation
                </h2>
              </div>
              
              {/* Step 1: Design Role */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#7C3AED",
                  fontSize: "0.9375rem"
                }}>
                  Design Role <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  list="ai-role-options"
                  value={aiRole}
                  onChange={(e) => handleFieldChange('role', e.target.value)}
                  placeholder="Select or type: UI Designer, UX Designer, etc."
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    backgroundColor: "#ffffff",
                    transition: "all 0.2s ease",
                  }}
                />
                <datalist id="ai-role-options">
                  <option value="UI Designer" />
                  <option value="UX Designer" />
                  <option value="Product Designer" />
                  <option value="Visual Designer" />
                  <option value="Interaction Designer" />
                </datalist>
              </div>

              {/* Step 2: Difficulty */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#7C3AED",
                  fontSize: "0.9375rem"
                }}>
                  Difficulty <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => handleFieldChange('difficulty', e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {DIFFICULTY_LEVELS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Step 3: Experience Level (Slider) */}
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.75rem", 
                  fontWeight: 600,
                  color: "#7C3AED",
                  fontSize: "0.9375rem"
                }}>
                  Experience Level <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div style={{
                  padding: "1.25rem 1.5rem",
                  backgroundColor: "#FFFFFF",
                  borderRadius: "0.5rem",
                  border: "1px solid #E5E7EB"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "0.875rem"
                  }}>
                    <span style={{ 
                      fontSize: "0.8125rem", 
                      color: "#9CA3AF",
                      fontWeight: 500
                    }}>
                      0 years
                    </span>
                    <span style={{ 
                      fontSize: "1.125rem", 
                      fontWeight: 600,
                      color: "#7C3AED"
                    }}>
                      {aiExperienceYears} {aiExperienceYears === 1 ? 'year' : 'years'}
                    </span>
                    <span style={{ 
                      fontSize: "0.8125rem", 
                      color: "#9CA3AF",
                      fontWeight: 500
                    }}>
                      15 years
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={aiExperienceYears}
                    onChange={(e) => handleFieldChange('experience', parseInt(e.target.value))}
                    className="custom-range-slider"
                    style={{
                      width: "100%",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  />
                  <style jsx>{`
                    .custom-range-slider {
                      -webkit-appearance: none;
                      appearance: none;
                      height: 2px !important;
                      border-radius: 1px;
                      background: linear-gradient(to right, #7C3AED 0%, #7C3AED ${(aiExperienceYears / 15) * 100}%, #E5E7EB ${(aiExperienceYears / 15) * 100}%, #E5E7EB 100%);
                    }
                    .custom-range-slider::-webkit-slider-track {
                      height: 2px;
                      background: transparent;
                    }
                    .custom-range-slider::-moz-range-track {
                      height: 2px;
                      background: transparent;
                    }
                    .custom-range-slider::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: #7C3AED;
                      cursor: pointer;
                      border: 2px solid #ffffff;
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                      transition: all 0.15s ease;
                      margin-top: -7px;
                    }
                    .custom-range-slider::-webkit-slider-thumb:hover {
                      transform: scale(1.1);
                      box-shadow: 0 2px 6px rgba(124, 58, 237, 0.3);
                    }
                    .custom-range-slider::-moz-range-thumb {
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: #7C3AED;
                      cursor: pointer;
                      border: 2px solid #ffffff;
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                      transition: all 0.15s ease;
                    }
                    .custom-range-slider::-moz-range-thumb:hover {
                      transform: scale(1.1);
                      box-shadow: 0 2px 6px rgba(124, 58, 237, 0.3);
                    }
                  `}</style>
                  <div style={{ 
                    marginTop: "0.75rem",
                    fontSize: "0.8125rem",
                    color: "#6B7280",
                    textAlign: "center",
                    fontWeight: 500
                  }}>
                    {aiExperienceYears === 0 && "Fresher / Entry Level"}
                    {aiExperienceYears > 0 && aiExperienceYears <= 3 && "Junior Designer"}
                    {aiExperienceYears > 3 && aiExperienceYears <= 5 && "Mid-Level Designer"}
                    {aiExperienceYears > 5 && aiExperienceYears <= 10 && "Senior Designer"}
                    {aiExperienceYears > 10 && "Expert / Lead Designer"}
                  </div>
                </div>
              </div>

              {/* Step 4: Topic Suggestions (appears after role, difficulty, experience are selected) */}
              {aiRole && aiDifficulty && (
                <div style={{ marginBottom: "2rem" }}>
                  {loadingSuggestions ? (
                    <div style={{
                      padding: "2rem",
                      backgroundColor: "#F9FAFB",
                      borderRadius: "0.5rem",
                      border: "1px solid #E5E7EB",
                      textAlign: "center"
                    }}>
                      <div style={{
                        display: "inline-block",
                        width: "24px",
                        height: "24px",
                        border: "3px solid #E5E7EB",
                        borderTop: "3px solid #7C3AED",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                      }}></div>
                      <style jsx>{`
                        @keyframes spin {
                          0% { transform: rotate(0deg); }
                          100% { transform: rotate(360deg); }
                        }
                      `}</style>
                      <p style={{ 
                        marginTop: "0.75rem",
                        color: "#6B7280",
                        fontSize: "0.875rem",
                        fontWeight: 500
                      }}>
                        Loading AI topic suggestions...
                      </p>
                    </div>
                  ) : taskTypeSuggestions.length > 0 ? (
                    <>
                      <label style={{ 
                        display: "block", 
                        marginBottom: "0.75rem", 
                        fontWeight: 600,
                        color: "#7C3AED",
                        fontSize: "0.9375rem"
                      }}>
                        Topic <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <p style={{ 
                        fontSize: "0.8125rem", 
                        color: "#6B7280", 
                        marginBottom: "1rem",
                        fontWeight: 500
                      }}>
                        Select a suggested topic or type your own
                      </p>
                      
                      {/* Topic Suggestions - Compact Pills */}
                      <div style={{ 
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "1rem"
                      }}>
                        {taskTypeSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectTaskType(suggestion)}
                            style={{
                              padding: selectedTaskType === suggestion ? "0.625rem 1.25rem" : "0.5rem 1rem",
                              backgroundColor: selectedTaskType === suggestion ? "#7C3AED" : "#F3F4F6",
                              color: selectedTaskType === suggestion ? "#FFFFFF" : "#374151",
                              border: selectedTaskType === suggestion ? "2px solid #7C3AED" : "1px solid #E5E7EB",
                              borderRadius: "9999px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              fontWeight: selectedTaskType === suggestion ? 700 : 500,
                              fontSize: selectedTaskType === suggestion ? "0.875rem" : "0.8125rem",
                              whiteSpace: "nowrap",
                              boxShadow: selectedTaskType === suggestion ? "0 4px 12px rgba(124, 58, 237, 0.35)" : "none",
                              transform: selectedTaskType === suggestion ? "scale(1.05)" : "scale(1)",
                            }}
                            onMouseEnter={(e) => {
                              if (selectedTaskType !== suggestion) {
                                e.currentTarget.style.borderColor = "#7C3AED"
                                e.currentTarget.style.backgroundColor = "#EDE9FE"
                                e.currentTarget.style.color = "#7C3AED"
                                e.currentTarget.style.transform = "scale(1.02)"
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedTaskType !== suggestion) {
                                e.currentTarget.style.borderColor = "#E5E7EB"
                                e.currentTarget.style.backgroundColor = "#F3F4F6"
                                e.currentTarget.style.color = "#374151"
                                e.currentTarget.style.transform = "scale(1)"
                              }
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>

                      {/* Custom Topic Input */}
                      <div style={{ 
                        padding: "1rem",
                        backgroundColor: "#F9FAFB",
                        borderRadius: "0.5rem",
                        border: "1px solid #E5E7EB"
                      }}>
                        <label style={{ 
                          display: "block", 
                          marginBottom: "0.5rem", 
                          fontWeight: 500,
                          color: "#6B7280",
                          fontSize: "0.8125rem"
                        }}>
                          Or enter your own topic
                        </label>
                        <input
                          type="text"
                          value={manualTaskType}
                          onChange={(e) => handleManualTaskType(e.target.value)}
                          placeholder="e.g., Music streaming dashboard, Recipe discovery app"
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            border: manualTaskType ? "2px solid #7C3AED" : "1px solid #D1D5DB",
                            borderRadius: "0.5rem",
                            fontSize: "0.875rem",
                            transition: "all 0.2s ease",
                            backgroundColor: "#FFFFFF",
                            outline: "none"
                          }}
                          onFocus={(e) => {
                            if (!manualTaskType) {
                              e.currentTarget.style.borderColor = "#7C3AED"
                            }
                          }}
                          onBlur={(e) => {
                            if (!manualTaskType) {
                              e.currentTarget.style.borderColor = "#D1D5DB"
                            }
                          }}
                        />
                        {manualTaskType && (
                          <p style={{ 
                            fontSize: "0.75rem", 
                            color: "#7C3AED", 
                            marginTop: "0.5rem",
                            fontWeight: 500
                          }}>
                            ✓ Using custom topic: "{manualTaskType}"
                          </p>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {/* Step 5: Open Requirements (Optional) */}
              {aiRole && aiDifficulty && (
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.625rem", 
                    fontWeight: 600,
                    color: "#7C3AED",
                    fontSize: "0.9375rem"
                  }}>
                    Additional Requirements <span style={{ 
                      fontSize: "0.8125rem", 
                      fontWeight: 500, 
                      color: "#6B7280" 
                    }}>(Optional)</span>
                  </label>
                  <p style={{ 
                    fontSize: "0.8125rem", 
                    color: "#6B7280", 
                    marginBottom: "0.75rem",
                    fontWeight: 500
                  }}>
                    Add any specific requirements, constraints, or context for this question
                  </p>
                  <textarea
                    value={openRequirements}
                    onChange={(e) => setOpenRequirements(e.target.value)}
                    placeholder="e.g., Must include dark mode support, Focus on accessibility features, Include mobile-first approach..."
                    style={{
                      width: "100%",
                      padding: "0.875rem 1rem",
                      border: openRequirements ? "2px solid #7C3AED" : "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      minHeight: "100px",
                      backgroundColor: "#ffffff",
                      transition: "all 0.2s ease",
                      resize: "vertical",
                      fontFamily: "inherit",
                      outline: "none"
                    }}
                    onFocus={(e) => {
                      if (!openRequirements) {
                        e.currentTarget.style.borderColor = "#7C3AED"
                      }
                    }}
                    onBlur={(e) => {
                      if (!openRequirements) {
                        e.currentTarget.style.borderColor = "#E8B4FA"
                      }
                    }}
                  />
                  {openRequirements && (
                    <p style={{ 
                      fontSize: "0.75rem", 
                      color: "#7C3AED", 
                      marginTop: "0.5rem",
                      fontWeight: 500
                    }}>
                      ✓ Additional requirements will be incorporated into the generated question
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleAiGenerate}
                disabled={generating}
                style={{
                  width: "100%",
                  padding: "1rem",
                  backgroundColor: "#9333EA",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: generating ? "not-allowed" : "pointer",
                  opacity: generating ? 0.6 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {generating ? "Generating..." : "🤖 Generate Question with AI"}
              </button>
            </div>
          ) : (
            /* Manual Creation Form */
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                  Title <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., E-commerce Landing Page Design"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                  Description <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the design challenge..."
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    minHeight: "120px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                    Role
                  </label>
                  <input
                    type="text"
                    list="role-options"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Select or type role"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <datalist id="role-options">
                    <option value="UI Designer" />
                    <option value="UX Designer" />
                    <option value="Product Designer" />
                    <option value="Visual Designer" />
                  </datalist>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                    Task Type
                  </label>
                  <input
                    type="text"
                    list="task-type-options"
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    placeholder="Select or type task"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <datalist id="task-type-options">
                    <option value="Landing Page" />
                    <option value="Mobile App" />
                    <option value="Dashboard" />
                    <option value="Component" />
                  </datalist>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {DIFFICULTY_LEVELS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                    Experience Level (Optional)
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">Select Experience Level</option>
                    {EXPERIENCE_LEVELS.map(e => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                    Time Limit (minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 60)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                    }}
                  />
                </div>
              </div>

              {/* Constraints */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                  Constraints
                </label>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.75rem" }}>
                  Add design constraints or rules (e.g., "Use only 3 colors", "Mobile-first approach", "Follow Material Design")
                </p>
                {constraints.map((constraint, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      value={constraint}
                      onChange={(e) => updateConstraint(idx, e.target.value)}
                      placeholder={`e.g., ${idx === 0 ? 'Use modern design principles' : idx === 1 ? 'Ensure responsive design' : 'Follow accessibility guidelines'}`}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        border: "1px solid #E8B4FA",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <button
                      onClick={() => removeConstraint(idx)}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#FEE2E2",
                        color: "#DC2626",
                        border: "none",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addConstraint}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#F3E8FF",
                    color: "#7C3AED",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  + Add Constraint
                </button>
              </div>

              {/* Deliverables */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                  Deliverables
                </label>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.75rem" }}>
                  Specify what the candidate needs to deliver (e.g., "High-fidelity mockup", "User flow diagram", "Design system")
                </p>
                {deliverables.map((deliverable, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      value={deliverable}
                      onChange={(e) => updateDeliverable(idx, e.target.value)}
                      placeholder={`e.g., ${idx === 0 ? 'High-fidelity design screens' : idx === 1 ? 'Design specifications' : 'Component library'}`}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        border: "1px solid #E8B4FA",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <button
                      onClick={() => removeDeliverable(idx)}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#FEE2E2",
                        color: "#DC2626",
                        border: "none",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addDeliverable}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#F3E8FF",
                    color: "#7C3AED",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  + Add Deliverable
                </button>
              </div>

              {/* Evaluation Criteria */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                  Evaluation Criteria
                </label>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.75rem" }}>
                  Define how the design will be evaluated (e.g., "Visual hierarchy", "Color usage", "Typography")
                </p>
                {evaluationCriteria.map((criteria, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      value={criteria}
                      onChange={(e) => updateCriteria(idx, e.target.value)}
                      placeholder={`e.g., ${idx === 0 ? 'Visual hierarchy and layout' : idx === 1 ? 'Color scheme and consistency' : 'Typography and readability'}`}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        border: "1px solid #E8B4FA",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <button
                      onClick={() => removeCriteria(idx)}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#FEE2E2",
                        color: "#DC2626",
                        border: "none",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={addCriteria}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#F3E8FF",
                    color: "#7C3AED",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  + Add Criteria
                </button>
              </div>

              <button
                onClick={handleCreate}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "1rem",
                  backgroundColor: "#9333EA",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {saving ? "Creating..." : "Create Question"}
              </button>
            </div>
          )}

          {error && (
            <div style={{
              padding: "1rem",
              backgroundColor: "#FEE2E2",
              color: "#DC2626",
              borderRadius: "0.5rem",
              marginTop: "1rem",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
