import { useState } from 'react'
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

export default function DesignQuestionCreatePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Question type toggle
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  
  // AI Generation fields
  const [aiRole, setAiRole] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState('intermediate')
  const [aiExperienceLevel, setAiExperienceLevel] = useState('')
  const [aiTaskType, setAiTaskType] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  
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

  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

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
        'ui designer': 'ui_designer',
        'ux designer': 'ux_designer',
        'product designer': 'product_designer',
        'visual designer': 'visual_designer',
      }
      
      const taskTypeMap: Record<string, string> = {
        'landing page': 'landing_page',
        'mobile app': 'mobile_app',
        'dashboard': 'dashboard',
        'component': 'component',
      }
      
      const normalizedRole = roleMap[aiRole.toLowerCase()] || aiRole.toLowerCase().replace(/\s+/g, '_')
      const normalizedTaskType = taskTypeMap[aiTaskType.toLowerCase()] || aiTaskType.toLowerCase().replace(/\s+/g, '_')
      
      const response = await fetch(`${API_URL}/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: normalizedRole,
          difficulty: aiDifficulty,
          experience_level: aiExperienceLevel || undefined,
          task_type: normalizedTaskType,
          topic: aiTopic.trim() || undefined,
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
      }
      
      const taskTypeMap: Record<string, string> = {
        'landing page': 'landing_page',
        'mobile app': 'mobile_app',
        'dashboard': 'dashboard',
        'component': 'component',
      }
      
      const normalizedRole = roleMap[role.toLowerCase()] || role.toLowerCase().replace(/\s+/g, '_')
      const normalizedTaskType = taskTypeMap[taskType.toLowerCase()] || taskType.toLowerCase().replace(/\s+/g, '_')
      
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
              marginBottom: "0.5rem", 
              color: "#7C3AED",
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em"
            }}>
              Create Design Question
            </h1>
            <p style={{ 
              color: "#9333EA", 
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
                  marginBottom: "0.5rem", 
                  color: "#7C3AED",
                  fontSize: "1.5rem",
                  fontWeight: 600
                }}>
                  AI Question Generation
                </h2>
                <p style={{ 
                  color: "#9333EA", 
                  fontSize: "0.875rem",
                  margin: 0
                }}>
                  Let AI generate a comprehensive design question based on your requirements
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
                    color: "#7C3AED",
                    fontSize: "0.9375rem"
                  }}>
                    Design Role <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={aiRole}
                    onChange={(e) => setAiRole(e.target.value)}
                    placeholder="e.g., UI Designer, UX Designer, Product Designer"
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
                </div>

                <div>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "0.625rem", 
                    fontWeight: 600,
                    color: "#7C3AED",
                    fontSize: "0.9375rem"
                  }}>
                    Task Type <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={aiTaskType}
                    onChange={(e) => setAiTaskType(e.target.value)}
                    placeholder="e.g., Landing Page, Mobile App, Dashboard"
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
                </div>
              </div>

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
                  onChange={(e) => setAiDifficulty(e.target.value)}
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

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#7C3AED",
                  fontSize: "0.9375rem"
                }}>
                  Experience Level (Optional)
                </label>
                <select
                  value={aiExperienceLevel}
                  onChange={(e) => setAiExperienceLevel(e.target.value)}
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
                  <option value="">Select Experience Level</option>
                  {EXPERIENCE_LEVELS.map(e => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.625rem", 
                  fontWeight: 600,
                  color: "#7C3AED",
                  fontSize: "0.9375rem"
                }}>
                  Topic (Optional)
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., E-commerce, Healthcare, Finance"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.9375rem",
                    transition: "all 0.2s ease",
                  }}
                />
              </div>

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
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g., UI Designer"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#7C3AED" }}>
                    Task Type
                  </label>
                  <input
                    type="text"
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    placeholder="e.g., Landing Page"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
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
