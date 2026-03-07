import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import apiClient from "@/services/api/client";
import { 
  ArrowLeft, 
  Settings, 
  ShieldCheck, 
  CalendarClock, 
  Users, 
  ListChecks, 
  Plus, 
  Trash2, 
  Bot 
} from "lucide-react";

interface Question {
  id: string;
  title: string;
  difficulty_level: string;
  topic: string;
}

// Timer mode types
type TimerMode = "GLOBAL" | "PER_QUESTION";

// Exam window mode (mirrors Custom MCQ scheduling semantics)
type ExamMode = "strict" | "flexible";

// Question timing for per-question mode
interface QuestionTiming {
  question_id: string;
  duration_minutes: number;
}

export default function CreateDataEngineeringTestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  // Simple AI proctoring toggle (controls camera-based proctoring on candidate side)
  const [proctoringSettings, setProctoringSettings] = useState({
    aiProctoringEnabled: false, // default OFF until explicitly enabled
    faceMismatchEnabled: false, // default OFF until explicitly enabled
    liveProctoringEnabled: false, // default OFF until explicitly enabled
  });
  
  // Timer mode state
  const [timerMode, setTimerMode] = useState<TimerMode>("GLOBAL");
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});

  // Exam window configuration (mirrors Custom MCQ)
  const [examMode, setExamMode] = useState<ExamMode>("strict");
  
  // Candidate Requirements
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireResume, setRequireResume] = useState(false);
  const [requireLinkedIn, setRequireLinkedIn] = useState(false);
  const [requireGithub, setRequireGithub] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    question_ids: [] as string[],
    duration_minutes: 60,
    start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16), // Default to 1 hour from now
    end_time: "",
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

  useEffect(() => {
    fetchQuestions();
    
    // Refresh questions when page becomes visible (e.g., returning from question creation)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQuestions();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh on focus (when user switches back to the tab)
    const handleFocus = () => {
      fetchQuestions();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await apiClient.get("/api/v1/data-engineering/questions?is_published=true");
      const data = response.data;
      setQuestions(data.questions || data || []);
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Exam window validation
    if (!formData.start_time) {
      alert("Start time is required.");
      return;
    }
    // For Flexible Window, end_time is required
    if (examMode === "flexible") {
      if (!formData.end_time) {
        alert("End time is required for flexible exam mode.");
        return;
      }
      if (new Date(formData.start_time) >= new Date(formData.end_time)) {
        alert("End time must be after start time.");
        return;
      }
    }
    if (examMode === "flexible") {
      const durationForSchedule =
        timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;
      if (!durationForSchedule || durationForSchedule < 1) {
        alert("Duration is required for flexible exam mode.");
        return;
      }
    }
    
    // Validation for per-question mode
    if (timerMode === "PER_QUESTION") {
      for (const qid of formData.question_ids) {
        const timing = questionTimings[qid];
        if (!timing || timing < 1) {
          alert(`Please set a valid duration (at least 1 minute) for all questions`);
          return;
        }
      }
    }
    
    setLoading(true);

    try {
      // Build payload based on timer mode
      console.log('[DSA Create] Proctoring settings being sent:', JSON.stringify({
        proctoringSettings,
        aiProctoringEnabled: proctoringSettings.aiProctoringEnabled,
        liveProctoringEnabled: proctoringSettings.liveProctoringEnabled,
      }, null, 2));
      
      const payload: any = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        timer_mode: timerMode,
        proctoringSettings,
        // New scheduling payload (mirrors Custom MCQ)
        examMode,
        schedule: {
          startTime: new Date(formData.start_time).toISOString(),
          // Only include endTime for flexible mode, omit it for strict mode
          ...(examMode === "flexible" && formData.end_time && formData.end_time.trim() !== "" 
            ? { endTime: new Date(formData.end_time).toISOString() }
            : {}),
          duration:
            examMode === "flexible"
              ? (timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes)
              : null,
          candidateRequirements: {
            requirePhone,
            requireResume,
            requireLinkedIn,
            requireGithub,
          },
        },
        // Also include top-level fields (requested shape)
        startTime: new Date(formData.start_time).toISOString(),
        // Only include endTime for flexible mode, omit it for strict mode
        ...(examMode === "flexible" && formData.end_time && formData.end_time.trim() !== ""
          ? { endTime: new Date(formData.end_time).toISOString() }
          : {}),
        duration:
          examMode === "flexible"
            ? (timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes)
            : null,
      };
      
      // Only include end_time in payload for flexible mode (and remove it if it's empty)
      if (examMode === "flexible" && formData.end_time && formData.end_time.trim() !== "") {
        payload.end_time = new Date(formData.end_time).toISOString();
      } else {
        // Explicitly remove end_time for strict mode to avoid sending empty string
        delete payload.end_time;
      }
      
      if (timerMode === "PER_QUESTION") {
        // Convert questionTimings record to array format expected by backend
        payload.question_timings = formData.question_ids.map(qid => ({
          question_id: qid,
          duration_minutes: questionTimings[qid] || 10,
        }));
        // Set total duration as sum of all question timings
        payload.duration_minutes = calculateTotalDuration();
      }
      
      // Create the test
      const response = await apiClient.post("/api/v1/data-engineering/tests", payload);
      
      const testId = response.data?.id || response.data?._id;

      alert("Test created successfully!");
      if (testId) {
        router.push(`/data-engineering/tests?testId=${encodeURIComponent(String(testId))}&refreshed=true`);
      } else {
        router.push("/data-engineering/tests");
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || error.response?.data?.message || "Failed to create Data Engineering test");
      setLoading(false);
    }
  };

  const toggleQuestion = (questionId: string) => {
    if (formData.question_ids.includes(questionId)) {
      // Remove from selected questions
      setFormData({
        ...formData,
        question_ids: formData.question_ids.filter((id) => id !== questionId),
      });
      // Also remove from question timings
      const newTimings = { ...questionTimings };
      delete newTimings[questionId];
      setQuestionTimings(newTimings);
    } else {
      // Add to selected questions
      setFormData({
        ...formData,
        question_ids: [...formData.question_ids, questionId],
      });
      // Initialize timing with default value (10 minutes)
      setQuestionTimings({
        ...questionTimings,
        [questionId]: 10,
      });
    }
  };

  // Update timing for a specific question
  const updateQuestionTiming = (questionId: string, minutes: number) => {
    setQuestionTimings({
      ...questionTimings,
      [questionId]: Math.max(1, minutes), // Minimum 1 minute
    });
  };

  // Calculate total duration from per-question timings
  const calculateTotalDuration = (): number => {
    return formData.question_ids.reduce((total, qid) => {
      return total + (questionTimings[qid] || 10);
    }, 0);
  };

  // Get question title by ID
  const getQuestionTitle = (questionId: string): string => {
    const question = questions.find(q => q.id === questionId);
    return question?.title || "Unknown Question";
  };


  const handleDeleteQuestion = async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete(`/api/v1/data-engineering/questions/${questionId}`);
      
      if (formData.question_ids.includes(questionId)) {
        setFormData({
          ...formData,
          question_ids: formData.question_ids.filter((id) => id !== questionId),
        });
      }
      
      await fetchQuestions();
      alert('Question deleted successfully!');
    } catch (error: any) {
      alert(error.response?.data?.detail || error.response?.data?.message || 'Failed to delete question');
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
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0",
              fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent",
              border: "none", fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#00684A"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#6B7280"; }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
            Create Data Engineering Test
          </h1>
          <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
            Configure test settings, schedule, and select PySpark questions.
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
                Test Title <span style={{ color: "#d61d1dff" }}>*</span>
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
                placeholder="e.g., Senior SDE Coding Assessment"
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
                placeholder="Briefly describe what this test evaluates..."
              />
            </div>
          </div>

          {/* Section 2: Proctoring Settings */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <ShieldCheck size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Proctoring Settings</h2>
            </div>
            
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginBottom: "1rem", padding: "1rem", backgroundColor: proctoringSettings.aiProctoringEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${proctoringSettings.aiProctoringEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
              <input
                type="checkbox"
                checked={proctoringSettings.aiProctoringEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setProctoringSettings((prev) => ({
                    ...prev,
                    aiProctoringEnabled: checked,
                    faceMismatchEnabled: checked ? prev.faceMismatchEnabled : false,
                  }));
                }}
                style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontWeight: 600, color: "#111827" }}>Enable AI Proctoring</div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Camera-based AI detection for missing face, multiple faces, and gaze tracking.</div>
              </div>
            </label>

            {proctoringSettings.aiProctoringEnabled && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginBottom: "1rem", marginLeft: "2rem", padding: "1rem", backgroundColor: proctoringSettings.faceMismatchEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${proctoringSettings.faceMismatchEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={proctoringSettings.faceMismatchEnabled}
                  onChange={(e) => {
                    setProctoringSettings((prev) => ({
                      ...prev,
                      faceMismatchEnabled: e.target.checked,
                    }));
                  }}
                  style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A", cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>Face Mismatch Detection</div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Continuously matches the candidate's face against the initial identity photo.</div>
                </div>
              </label>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", padding: "1rem", backgroundColor: proctoringSettings.liveProctoringEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${proctoringSettings.liveProctoringEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
              <input
                type="checkbox"
                checked={proctoringSettings.liveProctoringEnabled}
                onChange={(e) => {
                  setProctoringSettings((prev) => ({
                    ...prev,
                    liveProctoringEnabled: e.target.checked,
                  }));
                }}
                style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A", cursor: "pointer" }}
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
                <p style={{ margin: "0.25rem 0 0 1.5rem", fontSize: "0.8rem", color: "#6B7280" }}>Candidates can start anytime within a given time window.</p>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: examMode === "strict" ? "1fr" : "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
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
            </div>

            {formData.question_ids.length >= 2 && (
              <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#F9FAFB", borderRadius: "0.5rem", border: "1px solid #E5E7EB" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>Timer Mode</label>
                <div style={{ display: "flex", gap: "2rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="radio" name="timerMode" value="GLOBAL" checked={timerMode === "GLOBAL"} onChange={() => setTimerMode("GLOBAL")} style={{ accentColor: "#00684A" }} />
                    <span style={{ fontSize: "0.95rem" }}>Single global timer</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="radio" name="timerMode" value="PER_QUESTION" checked={timerMode === "PER_QUESTION"} onChange={() => setTimerMode("PER_QUESTION")} style={{ accentColor: "#00684A" }} />
                    <span style={{ fontSize: "0.95rem" }}>Timer per question</span>
                  </label>
                </div>
              </div>
            )}

            {(timerMode === "GLOBAL" || formData.question_ids.length < 2) && (
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                  Duration (minutes) <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input 
                  type="number" 
                  required 
                  min="1" 
                  value={formData.duration_minutes} 
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setFormData({ ...formData, duration_minutes: 0 });
                      return;
                    }
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setFormData({ ...formData, duration_minutes: numValue });
                    }
                  }}
                  onBlur={() => {
                    if (formData.duration_minutes < 1) {
                      setFormData({ ...formData, duration_minutes: 1 });
                    }
                  }}
                  style={{ width: "200px", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box" }} 
                  onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                  onBlurCapture={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                />
              </div>
            )}

            {timerMode === "PER_QUESTION" && formData.question_ids.length >= 2 && (
              <div style={{ border: "1px solid #D1D5DB", borderRadius: "0.5rem", padding: "1.25rem", backgroundColor: "#F9FAFB" }}>
                <p style={{ fontSize: "0.875rem", color: "#4B5563", margin: "0 0 1rem 0", fontWeight: 600 }}>Set duration for each individual question:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {formData.question_ids.map((qid, index) => (
                    <div key={qid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", backgroundColor: "#ffffff", borderRadius: "0.375rem", border: "1px solid #E5E7EB" }}>
                      <span style={{ fontWeight: 500, color: "#111827", fontSize: "0.95rem" }}>
                        {index + 1}. {getQuestionTitle(qid)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input 
                          type="number" 
                          min="1" 
                          value={questionTimings[qid] || 10} 
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value)) {
                              updateQuestionTiming(qid, value);
                            }
                          }}
                          style={{ width: "70px", padding: "0.375rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", textAlign: "center", outline: "none" }} 
                        />
                        <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>min</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#F0F9F4", borderRadius: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E1F2E9" }}>
                  <span style={{ fontWeight: 600, color: "#00684A" }}>Total Duration</span>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: "1.125rem" }}>{calculateTotalDuration()} mins</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Candidate Requirements */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <Users size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Candidate Info Requirements</h2>
            </div>
            <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#6B7280" }}>
              Select what information candidates must provide before starting the test.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requirePhone ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>Phone Number</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requireResume ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requireResume} onChange={(e) => setRequireResume(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>Resume (PDF Upload)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requireLinkedIn ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requireLinkedIn} onChange={(e) => setRequireLinkedIn(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>LinkedIn Profile URL</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: requireGithub ? "#F9FAFB" : "#ffffff" }}>
                <input type="checkbox" checked={requireGithub} onChange={(e) => setRequireGithub(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#00684A" }} />
                <span style={{ fontWeight: 500, color: "#374151" }}>GitHub Profile URL</span>
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
                <Plus size={16} /> Author New
              </button>
            </div>

            {questions.length === 0 ? (
              <div style={{ padding: "3rem", border: "1px dashed #D1D5DB", borderRadius: "0.5rem", textAlign: "center", backgroundColor: "#F9FAFB" }}>
                <Bot size={32} color="#9CA3AF" style={{ margin: "0 auto 1rem auto" }} />
                <p style={{ color: "#4B5563", fontWeight: 500 }}>No questions available in the repository.</p>
                <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>Create a question first to add it to this assessment.</p>
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
                        border: formData.question_ids.includes(q.id) ? "2px solid #00684A" : "1px solid #E5E7EB",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        backgroundColor: formData.question_ids.includes(q.id) ? "#F0F9F4" : "#ffffff",
                        transition: "all 0.2s"
                      }}
                      onClick={() => toggleQuestion(q.id)}
                    >
                      <input
                        type="checkbox"
                        checked={formData.question_ids.includes(q.id)}
                        onChange={() => toggleQuestion(q.id)}
                        style={{ width: "18px", height: "18px", accentColor: "#00684A", cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "#111827", fontSize: "1rem", marginBottom: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {q.title}
                        </div>
                        <div style={{ fontSize: "0.8rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span style={{ 
                            padding: "0.15rem 0.5rem", borderRadius: "0.25rem", fontWeight: 600, textTransform: "capitalize",
                            backgroundColor: q.difficulty_level === 'Beginner' ? "#D1FAE5" : q.difficulty_level === 'Intermediate' ? "#FEF3C7" : "#FEE2E2",
                            color: q.difficulty_level === 'Beginner' ? "#059669" : q.difficulty_level === 'Intermediate' ? "#D97706" : "#DC2626"
                          }}>
                            {q.difficulty_level}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteQuestion(q.id, e)}
                        style={{
                          padding: "0.5rem", border: "none", backgroundColor: "transparent", color: "#EF4444", 
                          cursor: "pointer", borderRadius: "0.375rem", transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FEE2E2"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        title="Delete permanently"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "0 0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: formData.question_ids.length > 0 ? "#00684A" : "#6B7280" }}>
                    {formData.question_ids.length} Question{formData.question_ids.length !== 1 ? 's' : ''} Selected
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Form Actions (Sticky Bottom) */}
          <div style={{ 
            position: "sticky", bottom: "0", backgroundColor: "rgba(255, 255, 255, 0.95)", 
            backdropFilter: "blur(12px)", padding: "1rem 0", borderTop: "1px solid #E5E7EB",
            display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", marginTop: "1rem", zIndex: 10
          }}>
            <button
              type="button"
              onClick={() => router.push("/data-engineering")}
              style={{ 
                padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#4B5563",
                backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "9999px",
                cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#F9FAFB";
                e.currentTarget.style.borderColor = "#9CA3AF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#D1D5DB";
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.question_ids.length === 0}
              style={{ 
                padding: "0.5rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff",
                backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "9999px",
                cursor: (loading || formData.question_ids.length === 0) ? "not-allowed" : "pointer", 
                opacity: (loading || formData.question_ids.length === 0) ? 0.7 : 1,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)", transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { 
                if(!(loading || formData.question_ids.length === 0)) {
                  e.currentTarget.style.backgroundColor = "#084A2A";
                  e.currentTarget.style.borderColor = "#084A2A";
                }
              }}
              onMouseLeave={(e) => { 
                if(!(loading || formData.question_ids.length === 0)) {
                  e.currentTarget.style.backgroundColor = "#00684A";
                  e.currentTarget.style.borderColor = "#00684A";
                }
              }}
            >
              {loading ? "Creating..." : "Save & Create Assessment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;