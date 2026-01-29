import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import axios from "@/lib/axios-config"; // Use configured axios with auth interceptor
import dsaApi from "../../lib/dsa/api";

interface Question {
  id: string;
  title: string;
  difficulty: string;
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

export default function CreateDSACompetencyPage() {
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
    start_time: "",
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
      const response = await dsaApi.get("/questions");
      setQuestions(response.data);
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
      const response = await dsaApi.post("/tests/", payload);
      
      const testId = response.data?.id || response.data?._id;

      // New tests should start unpublished; editor will publish from Test Management.
      alert("Test created successfully!");
      // After creating, land on Test Management filtered to this test only.
      if (testId) {
        router.push(`/dsa/tests?testId=${encodeURIComponent(String(testId))}&refreshed=true`);
      } else {
        router.push("/dsa/tests");
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || error.response?.data?.message || "Failed to create DSA competency test");
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
      await dsaApi.delete(`/questions/${questionId}`);
      
      // Remove from selected questions if it was selected
      if (formData.question_ids.includes(questionId)) {
        setFormData({
          ...formData,
          question_ids: formData.question_ids.filter((id) => id !== questionId),
        });
      }
      
      // Refresh questions list
      await fetchQuestions();
      alert('Question deleted successfully!');
    } catch (error: any) {
      alert(error.response?.data?.detail || error.response?.data?.message || 'Failed to delete question');
    }
  };

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        {/* Back Button */}
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
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>Create DSA Competency Test</h1>
          
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
                  border: "1px solid #A8E8BC",
                  borderRadius: "0.375rem",
                }}
                placeholder="e.g., Data Structures and Algorithms Assessment"
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
                  border: "1px solid #A8E8BC",
                  borderRadius: "0.375rem",
                  minHeight: "100px",
                }}
                placeholder="Describe the test..."
              />
            </div>

            {/* Proctoring Settings */}
            <div
              style={{
                marginTop: "2rem",
                padding: "1.5rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.75rem",
                border: "2px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  marginBottom: "1rem",
                  fontSize: "1.125rem",
                  color: "#1a1625",
                  fontWeight: 600,
                }}
              >
                Proctoring Settings
              </h3>

              {/* AI Proctoring Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "#1e293b",
                }}
              >
                <input
                  type="checkbox"
                  checked={proctoringSettings.aiProctoringEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setProctoringSettings((prev) => ({
                      ...prev,
                      aiProctoringEnabled: checked,
                      faceMismatchEnabled: checked ? prev.faceMismatchEnabled : false, // Disable face mismatch if AI Proctoring is disabled
                    }));
                  }}
                  style={{ 
                    width: "18px", 
                    height: "18px", 
                    cursor: "pointer",
                  }}
                />
                <span>
                  Enable AI Proctoring (camera-based: no face, multiple faces, gaze
                  away)
                </span>
              </label>

              {/* Face Mismatch Detection Sub-checkbox (only visible when AI Proctoring is enabled) */}
              {proctoringSettings.aiProctoringEnabled && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    color: "#1e293b",
                    marginTop: "0.5rem",
                    marginLeft: "2rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={proctoringSettings.faceMismatchEnabled}
                    onChange={(e) => {
                      setProctoringSettings((prev) => ({
                        ...prev,
                        faceMismatchEnabled: e.target.checked,
                      }));
                    }}
                    style={{ 
                      width: "18px", 
                      height: "18px", 
                      cursor: "pointer",
                    }}
                  />
                  <span>
                    Enable Face Mismatch Detection (detects if candidate's face changes during assessment)
                  </span>
                </label>
              )}

              {/* Live Proctoring Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "#1e293b",
                  marginTop: "1rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={proctoringSettings.liveProctoringEnabled}
                  onChange={(e) => {
                    setProctoringSettings((prev) => ({
                      ...prev,
                      liveProctoringEnabled: e.target.checked,
                    }));
                  }}
                  style={{ 
                    width: "18px", 
                    height: "18px", 
                    cursor: "pointer",
                  }}
                />
                <span>
                  Live Proctoring (webcam + screen streaming)
                </span>
              </label>
            </div>

            {/* Start and End Time */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Exam Window Configuration</h3>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <label
                  style={{
                    flex: 1,
                    padding: "1rem",
                    border: examMode === "strict" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    backgroundColor: examMode === "strict" ? "#E8FAF0" : "#ffffff",
                  }}
                >
                  <input
                    type="radio"
                    name="examMode"
                    value="strict"
                    checked={examMode === "strict"}
                    onChange={(e) => setExamMode(e.target.value as ExamMode)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  <strong style={{ color: "#1E5A3B" }}>Fixed Window (Strict)</strong>
                </label>
                <label
                  style={{
                    flex: 1,
                    padding: "1rem",
                    border: examMode === "flexible" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    backgroundColor: examMode === "flexible" ? "#E8FAF0" : "#ffffff",
                  }}
                >
                  <input
                    type="radio"
                    name="examMode"
                    value="flexible"
                    checked={examMode === "flexible"}
                    onChange={(e) => setExamMode(e.target.value as ExamMode)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  <strong style={{ color: "#1E5A3B" }}>Flexible Window</strong>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: examMode === "strict" ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.375rem",
                    }}
                  />
                  {examMode === "strict" && (
                    <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                      Test will automatically end after the configured test duration. Candidates can enter 15 minutes before start time for pre-checks.
                    </p>
                  )}
                </div>
                {examMode === "flexible" && (
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                      End Time *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #A8E8BC",
                        borderRadius: "0.375rem",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Timer Configuration - Show mode selector only when 2+ questions selected */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                Timer Configuration *
              </label>
              
              {formData.question_ids.length >= 2 && (
                <div style={{ 
                  marginBottom: "1rem", 
                  padding: "1rem", 
                  backgroundColor: "#F0FDF4", 
                  borderRadius: "0.375rem",
                  border: "1px solid #A8E8BC"
                }}>
                  <div style={{ display: "flex", gap: "2rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="timerMode"
                        value="GLOBAL"
                        checked={timerMode === "GLOBAL"}
                        onChange={() => setTimerMode("GLOBAL")}
                        style={{ accentColor: "#2D7A52" }}
                      />
                      <span>Single timer for entire test</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="timerMode"
                        value="PER_QUESTION"
                        checked={timerMode === "PER_QUESTION"}
                        onChange={() => setTimerMode("PER_QUESTION")}
                        style={{ accentColor: "#2D7A52" }}
                      />
                      <span>Individual timer per question</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Global Duration Input - shown when GLOBAL mode or single question */}
              {/* This field is used for both Fixed and Flexible windows */}
              {(timerMode === "GLOBAL" || formData.question_ids.length < 2) && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.875rem", color: "#374151" }}>
                    Duration (minutes){examMode === "flexible" ? " *" : ""}
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
                    style={{
                      width: "200px",
                      padding: "0.75rem",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.375rem",
                    }}
                  />
                </div>
              )}

              {/* Per-Question Duration Inputs - shown when PER_QUESTION mode and 2+ questions */}
              {timerMode === "PER_QUESTION" && formData.question_ids.length >= 2 && (
                <div>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.75rem" }}>
                    Set duration for each question individually:
                  </p>
                  <div style={{ 
                    border: "1px solid #A8E8BC", 
                    borderRadius: "0.375rem", 
                    padding: "1rem",
                    maxHeight: "300px",
                    overflowY: "auto"
                  }}>
                    {formData.question_ids.map((qid, index) => (
                      <div 
                        key={qid} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between",
                          padding: "0.75rem",
                          marginBottom: index < formData.question_ids.length - 1 ? "0.5rem" : 0,
                          backgroundColor: "#ffffff",
                          borderRadius: "0.375rem",
                          border: "1px solid #E8FAF0"
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500, color: "#1a1625" }}>
                            {index + 1}. {getQuestionTitle(qid)}
                          </span>
                        </div>
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
                            style={{
                              width: "80px",
                              padding: "0.5rem",
                              border: "1px solid #A8E8BC",
                              borderRadius: "0.375rem",
                              textAlign: "center",
                            }}
                          />
                          <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ 
                    marginTop: "0.75rem", 
                    padding: "0.75rem", 
                    backgroundColor: "#E8FAF0", 
                    borderRadius: "0.375rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span style={{ fontWeight: 600, color: "#2D7A52" }}>Total Duration:</span>
                    <span style={{ fontWeight: 600, color: "#1a1625" }}>
                      {calculateTotalDuration()} minutes
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Requirements */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem", backgroundColor: "#F3FFF8" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "#1a1625" }}>Candidate Requirements</h3>
              <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#2D7A52" }}>
                Select which information candidates must provide before taking the assessment.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={requirePhone}
                    onChange={(e) => setRequirePhone(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 600, color: "#1E5A3B" }}>Phone Number</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={requireResume}
                    onChange={(e) => setRequireResume(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 600, color: "#1E5A3B" }}>Resume (File Upload)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={requireLinkedIn}
                    onChange={(e) => setRequireLinkedIn(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 600, color: "#1E5A3B" }}>LinkedIn URL</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={requireGithub}
                    onChange={(e) => setRequireGithub(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 600, color: "#1E5A3B" }}>GitHub URL</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Select Questions *</label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => router.push("/dsa/questions/create")}
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                >
                  + Create Question
                </button>
              </div>


              {questions.length === 0 ? (
                <div style={{ padding: "2rem", border: "1px solid #A8E8BC", borderRadius: "0.375rem", textAlign: "center", color: "#2D7A52" }}>
                  <p>No questions available. Create a question using the button above.</p>
                </div>
              ) : (
                <>
                  <div style={{ border: "1px solid #A8E8BC", borderRadius: "0.375rem", padding: "1rem", maxHeight: "400px", overflowY: "auto" }}>
                    {questions.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          marginBottom: "0.5rem",
                          border: formData.question_ids.includes(q.id) ? "2px solid #2D7A52" : "1px solid #E8FAF0",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          backgroundColor: formData.question_ids.includes(q.id) ? "#E8FAF0" : "#ffffff",
                        }}
                        onClick={() => toggleQuestion(q.id)}
                      >
                        <input
                          type="checkbox"
                          checked={formData.question_ids.includes(q.id)}
                          onChange={() => toggleQuestion(q.id)}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1a1625" }}>{q.title}</div>
                          <div style={{ fontSize: "0.875rem", color: "#2D7A52", textTransform: "capitalize" }}>
                            {q.difficulty}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteQuestion(q.id, e)}
                          style={{
                            padding: "0.5rem",
                            border: "none",
                            backgroundColor: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "1.25rem",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "#2D7A52", marginTop: "0.5rem" }}>
                    Selected: {formData.question_ids.length} questions
                  </p>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => router.push("/dsa")}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || formData.question_ids.length === 0}
                style={{ flex: 1 }}
              >
                {loading ? "Creating..." : "Create DSA Competency Test"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
