import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";

interface Question {
  id: string;
  _id?: string;
  title: string;
  difficulty: string;
  role?: string;
  task_type?: string;
  ai_generated?: boolean;
}

export default function CreateDesignCompetencyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(true);
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState(false);
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false);
  
  // Timer mode state
  type TimerMode = "GLOBAL" | "PER_QUESTION";
  const [timerMode, setTimerMode] = useState<TimerMode>("GLOBAL");
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});

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
    question_ids: [] as string[],
    duration_minutes: 60,
    start_time: "",
    end_time: "",
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design';

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_URL}/questions`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Exam window validation
    if (examMode === "strict") {
      if (!formData.start_time) {
        alert("Start time is required for strict window mode.");
        return;
      }
      const durationForSchedule = timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;
      if (!durationForSchedule || durationForSchedule < 1) {
        alert("Duration is required for strict window mode.");
        return;
      }
    } else if (examMode === "flexible") {
      if (!formData.start_time) {
        alert("Schedule start time is required for flexible window mode.");
        return;
      }
      if (!formData.end_time) {
        alert("Schedule end time is required for flexible window mode.");
        return;
      }
      if (new Date(formData.start_time) >= new Date(formData.end_time)) {
        alert("End time must be after start time.");
        return;
      }
      const durationForSchedule = timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;
      if (!durationForSchedule || durationForSchedule < 1) {
        alert("Duration is required for flexible exam mode.");
        return;
      }
    }
    
    // Per-question validation
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
      const convertLocalToUTC = (localDateTime: string): string => {
        if (!localDateTime) return "";
        const localDate = new Date(localDateTime);
        if (isNaN(localDate.getTime())) {
          console.error("Invalid datetime:", localDateTime);
          return "";
        }
        return localDate.toISOString();
      };

      const durationForSchedule = timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;
      const { end_time, ...formDataWithoutEndTime } = formData;
      
      const startTimeUTC = convertLocalToUTC(formData.start_time);
      const endTimeUTC = examMode === "flexible" ? convertLocalToUTC(formData.end_time) : undefined;
      
      const payload: any = {
        ...formDataWithoutEndTime,
        start_time: startTimeUTC,
        proctoringSettings: { 
          aiProctoringEnabled,
          faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false,
          liveProctoringEnabled
        },
        examMode,
        schedule: {
          startTime: startTimeUTC,
          ...(examMode === "flexible" && endTimeUTC && { endTime: endTimeUTC }),
          duration: durationForSchedule,
          candidateRequirements: {
            requirePhone,
            requireResume,
            requireLinkedIn,
            requireGithub,
          },
        },
        startTime: startTimeUTC,
        ...(examMode === "flexible" && endTimeUTC && { endTime: endTimeUTC }),
        duration: durationForSchedule,
        timer_mode: timerMode,
      };

      if (timerMode === "PER_QUESTION") {
        payload.question_timings = formData.question_ids.map(qid => ({
          question_id: qid,
          duration_minutes: questionTimings[qid] || 10,
        }));
        payload.duration_minutes = calculateTotalDuration();
      }

      const response = await fetch(`${API_URL}/tests/create?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create test');
      }

      const result = await response.json();
      alert("Test created successfully!");
      router.push("/design/tests");
    } catch (error: any) {
      alert(error.message || "Failed to create Design competency test");
      setLoading(false);
    }
  };

  const toggleQuestion = (questionId: string) => {
    if (formData.question_ids.includes(questionId)) {
      setFormData({
        ...formData,
        question_ids: formData.question_ids.filter((id) => id !== questionId),
      });
      const newTimings = { ...questionTimings };
      delete newTimings[questionId];
      setQuestionTimings(newTimings);
    } else {
      setFormData({
        ...formData,
        question_ids: [...formData.question_ids, questionId],
      });
      setQuestionTimings({
        ...questionTimings,
        [questionId]: 10,
      });
    }
  };

  const updateQuestionTiming = (questionId: string, minutes: number) => {
    setQuestionTimings({
      ...questionTimings,
      [questionId]: Math.max(1, minutes),
    });
  };

  const calculateTotalDuration = (): number => {
    return formData.question_ids.reduce((total, qid) => total + (questionTimings[qid] || 10), 0);
  };

  const handleDeleteQuestion = async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/questions/${questionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        if (formData.question_ids.includes(questionId)) {
          setFormData({
            ...formData,
            question_ids: formData.question_ids.filter((id) => id !== questionId),
          });
        }
        
        await fetchQuestions();
        alert('Question deleted successfully!');
      } else {
        alert('Failed to delete question');
      }
    } catch (error: any) {
      alert('Failed to delete question');
    }
  };

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
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
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>Create Design Competency Test</h1>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Test Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8B4FA",
                  borderRadius: "0.375rem",
                }}
                placeholder="e.g., UI/UX Design Assessment"
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8B4FA",
                  borderRadius: "0.375rem",
                  minHeight: "100px",
                }}
                placeholder="Describe the test..."
              />
            </div>

            {/* Proctoring Settings */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "#1a1625" }}>Proctoring Settings</h3>
              
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={aiProctoringEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAiProctoringEnabled(checked);
                    if (!checked) {
                      setFaceMismatchEnabled(false);
                    }
                  }}
                  style={{ marginTop: "0.25rem" }}
                />
                <span>
                  <div style={{ fontWeight: 600, color: "#7C3AED" }}>
                    Enable AI Proctoring (camera-based: no face, multiple faces, gaze away)
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#9333EA", marginTop: "0.25rem" }}>
                    Identity photo capture + fullscreen + screen share gate remain required regardless.
                  </div>
                </span>
              </label>

              {aiProctoringEnabled && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginTop: "0.75rem", marginLeft: "2rem" }}>
                  <input
                    type="checkbox"
                    checked={faceMismatchEnabled}
                    onChange={(e) => setFaceMismatchEnabled(e.target.checked)}
                    style={{ marginTop: "0.25rem" }}
                  />
                  <span>
                    <div style={{ fontWeight: 600, color: "#7C3AED" }}>
                      Enable Face Mismatch Detection
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#9333EA", marginTop: "0.25rem" }}>
                      Detects if the candidate's face changes during the assessment.
                    </div>
                  </span>
                </label>
              )}

              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginTop: "1rem" }}>
                <input
                  type="checkbox"
                  checked={liveProctoringEnabled}
                  onChange={(e) => setLiveProctoringEnabled(e.target.checked)}
                  style={{ marginTop: "0.25rem" }}
                />
                <span>
                  <div style={{ fontWeight: 600, color: "#7C3AED" }}>
                    Enable Live Proctoring (webcam + screen streaming)
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#9333EA", marginTop: "0.25rem" }}>
                    Real-time monitoring via admin dashboard.
                  </div>
                </span>
              </label>
            </div>

            {/* Exam Window Configuration */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "#7C3AED" }}>Exam Window Configuration</h3>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <label style={{ flex: 1, padding: "1rem", border: examMode === "strict" ? "2px solid #9333EA" : "1px solid #E8B4FA", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: examMode === "strict" ? "#F9F5FF" : "#ffffff" }}>
                  <input type="radio" name="examMode" value="strict" checked={examMode === "strict"} onChange={(e) => setExamMode(e.target.value as ExamMode)} style={{ marginRight: "0.5rem" }} />
                  <strong style={{ color: "#7C3AED" }}>Fixed Window (Strict)</strong>
                </label>
                <label style={{ flex: 1, padding: "1rem", border: examMode === "flexible" ? "2px solid #9333EA" : "1px solid #E8B4FA", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: examMode === "flexible" ? "#F9F5FF" : "#ffffff" }}>
                  <input type="radio" name="examMode" value="flexible" checked={examMode === "flexible"} onChange={(e) => setExamMode(e.target.value as ExamMode)} style={{ marginRight: "0.5rem" }} />
                  <strong style={{ color: "#7C3AED" }}>Flexible Window</strong>
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: examMode === "strict" ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Start Time *</label>
                  <input type="datetime-local" required value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} style={{ width: "100%", padding: "0.75rem", border: "1px solid #E8B4FA", borderRadius: "0.375rem" }} />
                  {examMode === "strict" && (
                    <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                      Test will automatically end after the configured test duration.
                    </p>
                  )}
                </div>
                {examMode === "flexible" && (
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>End Time *</label>
                    <input type="datetime-local" required value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} style={{ width: "100%", padding: "0.75rem", border: "1px solid #E8B4FA", borderRadius: "0.375rem" }} />
                  </div>
                )}
              </div>
              <div style={{ marginTop: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes}
                  disabled={timerMode === "PER_QUESTION"}
                  onChange={(e) => {
                    const numValue = parseInt(e.target.value, 10);
                    if (!isNaN(numValue) && numValue >= 1) {
                      setFormData({ ...formData, duration_minutes: numValue });
                    }
                  }}
                  style={{ width: "200px", padding: "0.75rem", border: "1px solid #E8B4FA", borderRadius: "0.375rem", backgroundColor: timerMode === "PER_QUESTION" ? "#F3F4F6" : "#ffffff" }}
                />
              </div>
            </div>

            {/* Timer Configuration */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Timer Configuration *</label>
              {formData.question_ids.length >= 2 && (
                <div style={{ marginBottom: "1rem", padding: "1rem", backgroundColor: "#F9F5FF", borderRadius: "0.375rem", border: "1px solid #E8B4FA" }}>
                  <div style={{ display: "flex", gap: "2rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input type="radio" name="timerMode" value="GLOBAL" checked={timerMode === "GLOBAL"} onChange={() => setTimerMode("GLOBAL")} style={{ accentColor: "#9333EA" }} />
                      <span>Single timer for entire test</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input type="radio" name="timerMode" value="PER_QUESTION" checked={timerMode === "PER_QUESTION"} onChange={() => setTimerMode("PER_QUESTION")} style={{ accentColor: "#9333EA" }} />
                      <span>Individual timer per question</span>
                    </label>
                  </div>
                </div>
              )}

              {timerMode === "PER_QUESTION" && formData.question_ids.length >= 2 && (
                <div>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.75rem" }}>Set duration for each question individually:</p>
                  <div style={{ border: "1px solid #E8B4FA", borderRadius: "0.375rem", padding: "1rem" }}>
                    {formData.question_ids.map((qid, index) => (
                      <div key={qid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem", marginBottom: index < formData.question_ids.length - 1 ? "0.5rem" : 0, backgroundColor: "#ffffff", borderRadius: "0.375rem", border: "1px solid #F9F5FF" }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500, color: "#1a1625" }}>{index + 1}. {questions.find(q => (q.id || q._id) === qid)?.title || "Unknown Question"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input type="number" min="1" value={questionTimings[qid] || 10} onChange={(e) => updateQuestionTiming(qid, parseInt(e.target.value, 10) || 1)} style={{ width: "80px", padding: "0.5rem", border: "1px solid #E8B4FA", borderRadius: "0.375rem", textAlign: "center" }} />
                          <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#F9F5FF", borderRadius: "0.375rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#9333EA" }}>Total Duration:</span>
                    <span style={{ fontWeight: 600, color: "#1a1625" }}>{calculateTotalDuration()} minutes</span>
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Requirements */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "#1a1625" }}>Candidate Requirements</h3>
              <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#9333EA" }}>
                Select which information candidates must provide before taking the assessment.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                  <span style={{ fontWeight: 600, color: "#7C3AED" }}>Phone Number</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={requireResume} onChange={(e) => setRequireResume(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                  <span style={{ fontWeight: 600, color: "#7C3AED" }}>Resume (File Upload)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={requireLinkedIn} onChange={(e) => setRequireLinkedIn(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                  <span style={{ fontWeight: 600, color: "#7C3AED" }}>LinkedIn URL</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={requireGithub} onChange={(e) => setRequireGithub(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                  <span style={{ fontWeight: 600, color: "#7C3AED" }}>GitHub URL</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Select Questions *</label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => router.push("/design/questions/create")}
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                >
                  + Create Question
                </button>
              </div>

              {questions.length === 0 ? (
                <div style={{ padding: "2rem", border: "1px solid #E8B4FA", borderRadius: "0.375rem", textAlign: "center", color: "#9333EA" }}>
                  <p>No questions available. Create a question using the button above.</p>
                </div>
              ) : (
                <div style={{ border: "1px solid #E8B4FA", borderRadius: "0.375rem", padding: "1rem", maxHeight: "400px", overflowY: "auto" }}>
                  {questions.map((q) => {
                    const questionId = q.id || q._id || '';
                    return (
                      <div
                        key={questionId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          marginBottom: "0.5rem",
                          border: formData.question_ids.includes(questionId) ? "2px solid #9333EA" : "1px solid #F9F5FF",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          backgroundColor: formData.question_ids.includes(questionId) ? "#F9F5FF" : "#ffffff",
                        }}
                        onClick={() => toggleQuestion(questionId)}
                      >
                        <input
                          type="checkbox"
                          checked={formData.question_ids.includes(questionId)}
                          onChange={() => toggleQuestion(questionId)}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1a1625" }}>{q.title}</div>
                          <div style={{ fontSize: "0.875rem", color: "#9333EA", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ padding: "0.125rem 0.5rem", backgroundColor: "#F3E8FF", borderRadius: "0.25rem" }}>{q.difficulty}</span>
                            {q.role && <span>👤 {q.role.replace(/_/g, ' ')}</span>}
                            {q.task_type && <span>🎨 {q.task_type.replace(/_/g, ' ')}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteQuestion(questionId, e)}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            color: "#DC2626",
                            backgroundColor: "#FEE2E2",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => router.back()}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? "Creating..." : "Create Design Competency Test"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
