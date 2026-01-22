'use client'

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../../lib/auth";
import dsaApi from "../../../../lib/dsa/api";
// React Query hooks
import { 
  useDSATest, 
  useDSAQuestions, 
  useUpdateDSATest 
} from "@/hooks/api/useDSA";

interface Question {
  id: string;
  title: string;
  difficulty: string;
}

type TimerMode = "GLOBAL" | "PER_QUESTION";
type ExamMode = "strict" | "flexible";

interface QuestionTiming {
  question_id: string;
  duration_minutes: number;
}

interface DSATest {
  id: string;
  title: string;
  description: string;
  question_ids: string[];
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  examMode?: ExamMode;
  schedule?: { 
    startTime?: string; 
    endTime?: string; 
    duration?: number;
    candidateRequirements?: {
      requirePhone?: boolean;
      requireResume?: boolean;
      requireLinkedIn?: boolean;
      requireGithub?: boolean;
    };
  } | null;
  timer_mode?: TimerMode;
  question_timings?: Array<{ question_id: string; duration_minutes: number }> | null;
  question_time_limits?: Record<string, number> | null; // Legacy field
  proctoringSettings?: {
    aiProctoringEnabled?: boolean;
    faceMismatchEnabled?: boolean;
    liveProctoringEnabled?: boolean;
  } | null;
}

export default function EditDSACompetencyPage() {
  const router = useRouter();
  const { id } = router.query;
  const testId = typeof id === "string" ? id : null;

  // Use React Query hooks
  const testIdStr = testId || undefined;
  const { data: testData, isLoading: loadingTest, error: testError } = useDSATest(testIdStr);
  const { data: questionsData, isLoading: loadingQuestions } = useDSAQuestions();
  const updateTestMutation = useUpdateDSATest();
  
  const questions = questionsData || [];
  const loading = updateTestMutation.isPending;

  // Timer/exam config (must mirror backend semantics)
  const [timerMode, setTimerMode] = useState<TimerMode>("GLOBAL");
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});
  const [examMode, setExamMode] = useState<ExamMode>("strict");
  
  // Proctoring settings
  const [proctoringSettings, setProctoringSettings] = useState({
    aiProctoringEnabled: false,
    faceMismatchEnabled: false,
    liveProctoringEnabled: false,
  });

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

  const selectedQuestions = useMemo(
    () => questions.filter((q) => formData.question_ids.includes(q.id)),
    [questions, formData.question_ids]
  );

  const calculateTotalDuration = () => {
    return formData.question_ids.reduce((sum, qid) => sum + (questionTimings[qid] || 0), 0);
  };

  // Get question title by ID
  const getQuestionTitle = (questionId: string): string => {
    const question = questions.find(q => q.id === questionId);
    return question?.title || "Unknown Question";
  };

  // Removed fetchQuestions - now using useDSAQuestions hook

  const hydrateFromTest = (test: DSATest) => {
    // Helper function to convert ISO datetime string (UTC) to datetime-local format (local timezone)
    // The backend stores datetimes in UTC, but datetime-local inputs need local time
    const isoToLocalDatetime = (isoString: string | null | undefined): string => {
      if (!isoString) return "";
      try {
        // Ensure the ISO string is treated as UTC if it doesn't have timezone info
        let normalizedIso = isoString;
        // If the string doesn't end with Z or have timezone offset, assume it's UTC and add Z
        if (!normalizedIso.endsWith('Z') && !normalizedIso.match(/[+-]\d{2}:\d{2}$/)) {
          // If it's just YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss, add Z to indicate UTC
          if (normalizedIso.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)) {
            normalizedIso = normalizedIso + 'Z';
          }
        }
        
        // Create Date object from ISO string (JavaScript automatically converts UTC to local)
        const date = new Date(normalizedIso);
        if (isNaN(date.getTime())) {
          console.warn("Invalid date:", isoString, "normalized:", normalizedIso);
          return "";
        }
        
        // Get local time components (getFullYear, getMonth, etc. return local timezone values)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        const result = `${year}-${month}-${day}T${hours}:${minutes}`;
        // Debug: Show both UTC and local time to verify conversion
        const utcHours = String(date.getUTCHours()).padStart(2, '0');
        const utcMinutes = String(date.getUTCMinutes()).padStart(2, '0');
        console.log(`[isoToLocalDatetime] ${isoString} (normalized: ${normalizedIso}) -> UTC: ${utcHours}:${utcMinutes}, Local: ${hours}:${minutes} (timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
        return result;
      } catch (error) {
        console.error("Error converting datetime:", error, isoString);
        return "";
      }
    };

    // Try to get start_time from schedule.startTime if available, otherwise use start_time
    const startTimeValue = test.schedule?.startTime || test.start_time;
    // For end_time, only use it if examMode is flexible
    const endTimeValue = test.examMode === "flexible" ? (test.schedule?.endTime || test.end_time) : null;

    console.log("[hydrateFromTest] Loading test data:", {
      start_time: test.start_time,
      schedule_startTime: test.schedule?.startTime,
      end_time: test.end_time,
      schedule_endTime: test.schedule?.endTime,
      examMode: test.examMode,
      startTimeValue,
      endTimeValue,
      converted_start: isoToLocalDatetime(startTimeValue),
      converted_end: isoToLocalDatetime(endTimeValue)
    });

    setFormData({
      title: test.title || "",
      description: test.description || "",
      question_ids: test.question_ids || [],
      duration_minutes: test.duration_minutes || 60,
      start_time: isoToLocalDatetime(startTimeValue),
      end_time: isoToLocalDatetime(endTimeValue),
    });

    const mode = (test.examMode as ExamMode) || "strict";
    setExamMode(mode);

    // Use question_timings (new format) or fallback to question_time_limits (legacy)
    const timings = test.question_timings || test.question_time_limits || null;
    if (timings) {
      // Handle array format (question_timings) or object format (question_time_limits)
      if (Array.isArray(timings) && timings.length > 0) {
        setTimerMode("PER_QUESTION");
        const limits: Record<string, number> = {};
        timings.forEach((t: any) => {
          if (t.question_id && t.duration_minutes) {
            limits[t.question_id] = t.duration_minutes;
          }
        });
        setQuestionTimings(Object.keys(limits).length > 0 ? limits : {});
      } else if (typeof timings === 'object' && !Array.isArray(timings) && Object.keys(timings).length > 0) {
        setTimerMode("PER_QUESTION");
        setQuestionTimings(timings as Record<string, number>);
      } else {
        setTimerMode("GLOBAL");
        setQuestionTimings({});
      }
    } else {
      setTimerMode("GLOBAL");
      setQuestionTimings({});
    }
    
    // Load proctoring settings
    const proctoring = test.proctoringSettings || {};
    setProctoringSettings({
      aiProctoringEnabled: proctoring.aiProctoringEnabled === true,
      faceMismatchEnabled: proctoring.faceMismatchEnabled === true,
      liveProctoringEnabled: proctoring.liveProctoringEnabled === true,
    });

    // Load candidate requirements from schedule
    const candidateReqs = test.schedule?.candidateRequirements || {};
    setRequirePhone(candidateReqs.requirePhone === true);
    setRequireResume(candidateReqs.requireResume === true);
    setRequireLinkedIn(candidateReqs.requireLinkedIn === true);
    setRequireGithub(candidateReqs.requireGithub === true);
  };

  // Hydrate form when test data is loaded
  useEffect(() => {
    if (testData) {
      hydrateFromTest(testData as any);
    }
  }, [testData]);

  // Handle error - redirect if test not found
  useEffect(() => {
    if (testError && testId) {
      alert(testError.message || "Failed to load test");
      router.push("/dsa/tests");
    }
  }, [testError, testId, router]);

  // Removed fetchTest and fetchQuestions - now using React Query hooks

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId) return;

    // Exam window validation (matching create page)
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

    try {
      // Build payload based on timer mode (matching create page)
      const payload: any = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        timer_mode: timerMode,
        // New scheduling payload
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
      } else {
        payload.question_timings = null;
      }
      
      // Include proctoring settings in payload
      payload.proctoringSettings = {
        aiProctoringEnabled: proctoringSettings.aiProctoringEnabled,
        faceMismatchEnabled: proctoringSettings.aiProctoringEnabled ? proctoringSettings.faceMismatchEnabled : false, // Only enabled if AI Proctoring is enabled
        liveProctoringEnabled: proctoringSettings.liveProctoringEnabled,
      };

      await updateTestMutation.mutateAsync({
        testId: testId!,
        data: payload,
      });
      
      // React Query will automatically refetch and update the UI
      alert("Test updated successfully!");
      // Add a small delay to ensure backend has saved the changes
      setTimeout(() => {
        router.push(`/dsa/tests?testId=${encodeURIComponent(String(testId))}&refreshed=true`);
      }, 200);
    } catch (error: any) {
      console.error("Update error:", error);
      alert(error.message || "Failed to update test");
    }
  };

  if (loadingTest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        <h1 className="text-3xl font-bold mb-2">Edit DSA Competency Test</h1>
        <p className="text-muted-foreground mb-6">
          Update test details for this assessment ID only.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-medium">Title</label>
            <input
              className="input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block font-medium">Description</label>
            <textarea
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>

          {/* Exam Window Configuration - matching create page */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
              Exam Window Configuration *
            </label>
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
                  {formData.question_ids.map((qid, index) => {
                    const question = questions.find(q => q.id === qid);
                    return (
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
                            {index + 1}. {question?.title || "Unknown Question"}
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
                                setQuestionTimings({
                                  ...questionTimings,
                                  [qid]: Math.max(1, value), // Minimum 1 minute
                                });
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
                    );
                  })}
                </div>
                <div style={{ 
                  marginTop: "0.75rem", 
                  padding: "0.75rem", 
                  backgroundColor: "#E8FAF0", 
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  color: "#1E5A3B"
                }}>
                  <strong>Total Duration: {calculateTotalDuration()} minutes</strong>
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

          {/* Proctoring Settings */}
          <div style={{ marginBottom: "1.5rem", padding: "1.25rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Proctoring Settings</h3>
            
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
                    // If Live Proctoring is enabled, AI Proctoring should also be enabled
                    liveProctoringEnabled: prev.liveProctoringEnabled && checked ? prev.liveProctoringEnabled : (prev.liveProctoringEnabled && !checked ? false : prev.liveProctoringEnabled),
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
                  const checked = e.target.checked;
                  setProctoringSettings((prev) => ({
                    ...prev,
                    liveProctoringEnabled: checked,
                    // When Live Proctoring is enabled, AI Proctoring should also be enabled
                    aiProctoringEnabled: checked ? true : prev.aiProctoringEnabled,
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

          <div className="space-y-2">
            <label className="block font-medium">Questions</label>
            <div className="space-y-2">
              {questions.map((q) => {
                const checked = formData.question_ids.includes(q.id);
                return (
                  <label key={q.id} className="flex items-center gap-3 border rounded p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...formData.question_ids, q.id]
                          : formData.question_ids.filter((x) => x !== q.id);
                        setFormData({ ...formData, question_ids: next });
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{q.title}</div>
                      <div className="text-xs text-muted-foreground">Difficulty: {q.difficulty}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.push("/dsa/tests")}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
