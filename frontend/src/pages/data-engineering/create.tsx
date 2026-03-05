import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import { useDataEngineeringQuestions } from "@/hooks/api/useDataEngineering";
import { 
  ArrowLeft, 
  Settings, 
  ShieldCheck, 
  CalendarClock, 
  Users,
  ListChecks,
  Plus,
  Bot,
  FileText
} from "lucide-react";

interface Question {
  id: string;
  title: string;
  description: string;
  difficulty_level: number;
  topic: string;
  is_published?: boolean;
  metadata?: {
    ai_generated?: boolean;
  };
}

export default function CreateDataEngineeringAssessmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Proctoring settings
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(true);
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState(false);
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false);
  
  // Exam window configuration
  type ExamMode = "strict" | "flexible";
  const [examMode, setExamMode] = useState<ExamMode>("strict");
  
  // Candidate Requirements
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireResume, setRequireResume] = useState(false);
  const [requireLinkedIn, setRequireLinkedIn] = useState(false);
  const [requireGithub, setRequireGithub] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    duration_minutes: 60,
    start_time: "",
    end_time: "",
  });

  // Fetch questions from API
  const { data: questionsData = [], refetch: refetchQuestions } = useDataEngineeringQuestions();
  const allQuestions = (questionsData as Question[]) || [];
  
  // Filter to show only published questions
  const questions = allQuestions.filter(q => q.is_published === true);
  
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  // Refetch questions on visibility/focus change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchQuestions();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const handleFocus = () => {
      refetchQuestions();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert("Title is required");
      return;
    }

    if (selectedQuestions.length === 0) {
      alert("Please select at least one question");
      return;
    }

    if (examMode === "strict" && !formData.start_time) {
      alert("Start time is required for strict window mode");
      return;
    }

    if (examMode === "flexible") {
      if (!formData.start_time || !formData.end_time) {
        alert("Both start and end times are required for flexible window mode");
        return;
      }
      if (new Date(formData.start_time) >= new Date(formData.end_time)) {
        alert("End time must be after start time");
        return;
      }
    }

    setLoading(true);

    try {
      // TODO: Implement assessment creation API call
      const payload = {
        ...formData,
        question_ids: selectedQuestions,
        proctoringSettings: {
          aiProctoringEnabled,
          faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false,
          liveProctoringEnabled
        },
        examMode,
        candidateRequirements: {
          requirePhone,
          requireResume,
          requireLinkedIn,
          requireGithub,
        },
      };

      console.log("Assessment payload:", payload);
      alert("Assessment creation coming soon!");
      // router.push("/data-engineering/assessments");
    } catch (error: any) {
      alert(error.message || "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  };

  const toggleQuestion = (questionId: string) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(selectedQuestions.filter(id => id !== questionId));
    } else {
      setSelectedQuestions([...selectedQuestions, questionId]);
    }
  };

  const getDifficultyLabel = (level: number): string => {
    switch (level) {
      case 1:
        return 'Easy';
      case 2:
        return 'Medium';
      case 3:
        return 'Hard';
      default:
        return 'Unknown';
    }
  };

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.back()}
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
            onMouseOver={(e) => { e.currentTarget.style.color = "#00684A"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#6B7280"; }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
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
            Create Data Engineering Assessment
          </h1>
          <p style={{ 
            color: "#6B7280", 
            fontSize: "1rem",
            margin: 0
          }}>
            Configure assessment settings, schedule, and select questions
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Section 1: Basic Information */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <Settings size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Basic Information</h2>
            </div>
            
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                Assessment Title <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                placeholder="e.g., Senior Data Engineer Assessment 2026"
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: "100%", padding: "1rem", border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem", minHeight: "100px", fontSize: "0.95rem", 
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
                placeholder="Briefly describe what this assessment evaluates..."
              />
            </div>
          </div>

          {/* Section 2: Proctoring Settings */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <ShieldCheck size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Proctoring Settings</h2>
            </div>
            
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginBottom: "1rem", padding: "1rem", backgroundColor: aiProctoringEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${aiProctoringEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
              <input
                type="checkbox"
                checked={aiProctoringEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAiProctoringEnabled(checked);
                  if (!checked) setFaceMismatchEnabled(false);
                }}
                style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A" }}
              />
              <div>
                <div style={{ fontWeight: 600, color: "#111827" }}>Enable AI Proctoring</div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Camera-based AI detection for missing face, multiple faces, and gaze tracking.</div>
              </div>
            </label>

            {aiProctoringEnabled && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginBottom: "1rem", marginLeft: "2rem", padding: "1rem", backgroundColor: faceMismatchEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${faceMismatchEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={faceMismatchEnabled}
                  onChange={(e) => setFaceMismatchEnabled(e.target.checked)}
                  style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A" }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>Face Mismatch Detection</div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Continuously matches the candidate's face against the initial identity photo.</div>
                </div>
              </label>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", padding: "1rem", backgroundColor: liveProctoringEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${liveProctoringEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
              <input
                type="checkbox"
                checked={liveProctoringEnabled}
                onChange={(e) => setLiveProctoringEnabled(e.target.checked)}
                style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A" }}
              />
              <div>
                <div style={{ fontWeight: 600, color: "#111827" }}>Enable Live Proctoring</div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Real-time streaming of webcam and screen to the admin dashboard.</div>
              </div>
            </label>
          </div>

          {/* Section 3: Exam Window & Timing */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <CalendarClock size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Scheduling & Timers</h2>
            </div>
            
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
              <label style={{ flex: 1, padding: "1rem", border: examMode === "strict" ? "2px solid #00684A" : "1px solid #D1D5DB", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: examMode === "strict" ? "#F0F9F4" : "#ffffff", transition: "all 0.2s" }}>
                <input type="radio" name="examMode" value="strict" checked={examMode === "strict"} onChange={(e) => setExamMode(e.target.value as ExamMode)} style={{ marginRight: "0.5rem", accentColor: "#00684A" }} />
                <strong style={{ color: examMode === "strict" ? "#00684A" : "#374151" }}>Fixed Window (Strict)</strong>
                <p style={{ margin: "0.25rem 0 0 1.5rem", fontSize: "0.8rem", color: "#6B7280" }}>Everyone starts and ends at the exact same time.</p>
              </label>
              <label style={{ flex: 1, padding: "1rem", border: examMode === "flexible" ? "2px solid #00684A" : "1px solid #D1D5DB", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: examMode === "flexible" ? "#F0F9F4" : "#ffffff", transition: "all 0.2s" }}>
                <input type="radio" name="examMode" value="flexible" checked={examMode === "flexible"} onChange={(e) => setExamMode(e.target.value as ExamMode)} style={{ marginRight: "0.5rem", accentColor: "#00684A" }} />
                <strong style={{ color: examMode === "flexible" ? "#00684A" : "#374151" }}>Flexible Window</strong>
                <p style={{ margin: "0.25rem 0 0 1.5rem", fontSize: "0.8rem", color: "#6B7280" }}>Candidates can start anytime within a time window.</p>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: examMode === "strict" ? "1fr 1fr" : "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  Start Time <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input 
                  type="datetime-local" 
                  required 
                  value={formData.start_time} 
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} 
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box" }} 
                  onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                />
              </div>
              {examMode === "flexible" && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    End Time <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input 
                    type="datetime-local" 
                    required 
                    value={formData.end_time} 
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} 
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box" }} 
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                </div>
              )}
              {examMode === "strict" && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Duration (minutes) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    value={formData.duration_minutes} 
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Math.max(1, parseInt(e.target.value || "1", 10)) })} 
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box" }} 
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Candidate Requirements */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <Users size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Candidate Info Requirements</h2>
            </div>
            <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#6B7280" }}>
              Select what information candidates must provide before starting the assessment.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requirePhone ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>Phone Number</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requireResume ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requireResume} onChange={(e) => setRequireResume(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>Resume/CV</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requireLinkedIn ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requireLinkedIn} onChange={(e) => setRequireLinkedIn(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>LinkedIn Profile</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requireGithub ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requireGithub} onChange={(e) => setRequireGithub(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>GitHub Profile</span>
              </label>
            </div>
          </div>

          {/* Section 5: Question Selection */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ListChecks size={20} color="#00684A" />
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Select Questions</h2>
              </div>
              <button
                type="button"
                onClick={() => router.push("/data-engineering/questions/create")}
                style={{ 
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.5rem 1rem", backgroundColor: "#F0F9F4", color: "#00684A", 
                  border: "1px solid #E1F2E9", borderRadius: "0.5rem", fontSize: "0.875rem", 
                  fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#E1F2E9"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#F0F9F4"}
              >
                <Plus size={16} />Create New Question
              </button>
            </div>
            
            {questions.length === 0 ? (
              <div style={{ padding: "3rem", border: "1px dashed #D1D5DB", borderRadius: "0.5rem", textAlign: "center", backgroundColor: "#F9FAFB" }}>
                <FileText size={32} color="#9CA3AF" style={{ margin: "0 auto 1rem auto" }} />
                <p style={{ color: "#4B5563", fontWeight: 500, marginBottom: "0.5rem" }}>No published questions available.</p>
                <p style={{ color: "#6B7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Create and publish questions to add them to assessments.</p>
                <button
                  type="button"
                  onClick={() => router.push("/data-engineering/questions/create")}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#00684A",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#005A3F"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                >
                  Create Questions
                </button>
              </div>
            ) : (
              <>
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem", padding: "1rem", maxHeight: "400px", overflowY: "auto", backgroundColor: "#F9FAFB" }}>
                  {questions.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "1rem",
                        marginBottom: "0.5rem",
                        border: selectedQuestions.includes(q.id) ? "2px solid #00684A" : "1px solid #E5E7EB",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        backgroundColor: selectedQuestions.includes(q.id) ? "#F0F9F4" : "#ffffff",
                        transition: "all 0.2s"
                      }}
                      onClick={() => toggleQuestion(q.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(q.id)}
                        onChange={() => toggleQuestion(q.id)}
                        style={{ width: "18px", height: "18px", accentColor: "#00684A", cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "#111827", fontSize: "1rem", marginBottom: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {q.title}
                        </div>
                        <div style={{ fontSize: "0.8rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ 
                            padding: "0.15rem 0.5rem", borderRadius: "0.25rem", fontWeight: 600,
                            backgroundColor: q.difficulty_level === 1 ? "#D1FAE5" : q.difficulty_level === 2 ? "#FEF3C7" : "#FEE2E2",
                            color: q.difficulty_level === 1 ? "#059669" : q.difficulty_level === 2 ? "#D97706" : "#DC2626"
                          }}>
                            {getDifficultyLabel(q.difficulty_level)}
                          </span>
                          {q.topic && <span style={{ color: "#4B5563" }}>• {q.topic}</span>}
                          {q.metadata?.ai_generated && <span style={{ color: "#7C3AED", display: "flex", alignItems: "center", gap: "0.25rem" }}><Bot size={12} /> AI Generated</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "0 0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: selectedQuestions.length > 0 ? "#00684A" : "#6B7280" }}>
                    {selectedQuestions.length} Question{selectedQuestions.length !== 1 ? 's' : ''} Selected
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || selectedQuestions.length === 0}
            style={{
              width: "100%",
              padding: "1rem",
              backgroundColor: loading || selectedQuestions.length === 0 ? "#9CA3AF" : "#00684A",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading || selectedQuestions.length === 0 ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              if (!loading && selectedQuestions.length > 0) {
                e.currentTarget.style.backgroundColor = "#005A3F";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && selectedQuestions.length > 0) {
                e.currentTarget.style.backgroundColor = "#00684A";
              }
            }}
          >
            {loading ? "Creating Assessment..." : "Create Assessment"}
          </button>
        </form>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
