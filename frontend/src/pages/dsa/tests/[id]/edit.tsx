import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../../lib/auth";
import dsaApi from "../../../../lib/dsa/api";
import { useDSATest, useDSAQuestions, useUpdateDSATest } from "@/hooks/api/useDSA";
import { 
  ArrowLeft, Settings, ShieldCheck, CalendarClock, 
  Users, ListChecks, Loader2
} from "lucide-react";

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

  // Use React Query hooks - use lightweight questions for edit page
  const testIdStr = testId || undefined;
  const { data: testData, isLoading: loadingTest, error: testError } = useDSATest(testIdStr);
  const { data: questionsData, isLoading: loadingQuestions } = useDSAQuestions(true); // lightweight=true
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId) return;

    // Exam window validation (matching create page)
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
      // endTime is calculated from startTime + duration, not required from user
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
      const durationForSchedule = timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;

      // Build payload - exclude end_time for strict mode
      const { end_time, ...formDataWithoutEndTime } = formData;
      
      const payload: any = {
        ...formDataWithoutEndTime,
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
        faceMismatchEnabled: proctoringSettings.aiProctoringEnabled ? proctoringSettings.faceMismatchEnabled : false,
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

  const updateQuestionTiming = (questionId: string, minutes: number) => {
    setQuestionTimings({
      ...questionTimings,
      [questionId]: Math.max(1, minutes),
    });
  };

  // Show loading state while fetching test or questions data
  if (loadingTest || loadingQuestions || !testData) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <Loader2 size={40} className="animate-spin" />
          <span style={{ fontWeight: 500 }}>
            {loadingTest ? "Loading test data..." : loadingQuestions ? "Loading questions..." : "Loading..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0",
              fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent",
              border: "none", fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#00684A"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#6B7280"; }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back to Dashboard
          </button>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
            Edit DSA Competency Test
          </h1>
          <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
            Update test configuration, timer settings, and modify question selections.
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
                Test Title <span style={{ color: "#DC2626" }}>*</span>
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
                onFocus={(e) => { e.currentTarget.style.borderColor = "#00684A"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.boxShadow = "none"; }}
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
                onFocus={(e) => { e.currentTarget.style.borderColor = "#00684A"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.boxShadow = "none"; }}
                placeholder="Describe the test..."
              />
            </div>
          </div>

          {/* Section 2: Exam Window Configuration & Timing */}
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
                {examMode === "strict" && (
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#6B7280" }}>Test automatically ends based on duration.</p>
                )}
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
                  {examMode === "strict" && <span style={{ fontWeight: 400, color: "#6B7280", marginLeft: "0.5rem" }}>(Calculates end time)</span>}
                </label>
                <input 
                  type="number" 
                  required 
                  min="1" 
                  value={formData.duration_minutes} 
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') { setFormData({ ...formData, duration_minutes: 0 }); return; }
                    const numValue = parseInt(value, 10);
                    if (!isNaN(numValue) && numValue >= 1) { setFormData({ ...formData, duration_minutes: numValue }); }
                  }}
                  onBlur={() => { if (formData.duration_minutes < 1) setFormData({ ...formData, duration_minutes: 1 }); }}
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
                  {formData.question_ids.map((qid, index) => {
                    const question = questions.find(q => q.id === qid);
                    return (
                      <div key={qid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", backgroundColor: "#ffffff", borderRadius: "0.375rem", border: "1px solid #E5E7EB" }}>
                        <span style={{ fontWeight: 500, color: "#111827", fontSize: "0.95rem" }}>
                          {index + 1}. {question?.title || "Unknown Question"}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input 
                            type="number" 
                            min="1" 
                            value={questionTimings[qid] || 10} 
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value)) updateQuestionTiming(qid, value);
                            }}
                            style={{ width: "70px", padding: "0.375rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", textAlign: "center", outline: "none" }} 
                          />
                          <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>min</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#F0F9F4", borderRadius: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E1F2E9" }}>
                  <span style={{ fontWeight: 600, color: "#00684A" }}>Total Duration</span>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: "1.125rem" }}>{calculateTotalDuration()} mins</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Candidate Info Requirements */}
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

          {/* Section 4: Proctoring Settings */}
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
                    liveProctoringEnabled: prev.liveProctoringEnabled && checked ? prev.liveProctoringEnabled : (prev.liveProctoringEnabled && !checked ? false : prev.liveProctoringEnabled),
                  }));
                }}
                style={{ marginTop: "0.25rem", width: "16px", height: "16px", accentColor: "#00684A", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontWeight: 600, color: "#111827" }}>Enable AI Proctoring</div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Camera-based AI detection for missing face, multiple faces, and gaze tracking. Identity photo capture + fullscreen + screen share gate remain required.</div>
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
                  <div style={{ fontWeight: 600, color: "#111827" }}>Enable Face Mismatch Detection</div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>Continuously matches the candidate's face against the initial identity photo.</div>
                </div>
              </label>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", padding: "1rem", backgroundColor: proctoringSettings.liveProctoringEnabled ? "#F0F9F4" : "#F9FAFB", border: `1px solid ${proctoringSettings.liveProctoringEnabled ? "#A8E8BC" : "#E5E7EB"}`, borderRadius: "0.5rem" }}>
              <input
                type="checkbox"
                checked={proctoringSettings.liveProctoringEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setProctoringSettings((prev) => ({
                    ...prev,
                    liveProctoringEnabled: checked,
                    aiProctoringEnabled: checked ? true : prev.aiProctoringEnabled,
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

          {/* Section 5: Question Selection */}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ListChecks size={20} color="#00684A" />
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Select Questions</h2>
              </div>
            </div>

            {questions.length === 0 ? (
              <div style={{ padding: "3rem", border: "1px dashed #D1D5DB", borderRadius: "0.5rem", textAlign: "center", backgroundColor: "#F9FAFB" }}>
                <p style={{ color: "#6B7280", fontWeight: 500, margin: 0 }}>No questions available in the repository.</p>
              </div>
            ) : (
              <>
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem", padding: "1rem", maxHeight: "400px", overflowY: "auto", backgroundColor: "#F9FAFB" }}>
                  {questions.map((q) => {
                    const isChecked = formData.question_ids.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          padding: "1rem",
                          marginBottom: "0.5rem",
                          border: isChecked ? "2px solid #00684A" : "1px solid #E5E7EB",
                          borderRadius: "0.5rem",
                          cursor: "pointer",
                          backgroundColor: isChecked ? "#F0F9F4" : "#ffffff",
                          transition: "all 0.2s"
                        }}
                        onClick={() => {
                          const next = isChecked
                            ? formData.question_ids.filter((x) => x !== q.id)
                            : [...formData.question_ids, q.id];
                          setFormData({ ...formData, question_ids: next });
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...formData.question_ids, q.id]
                              : formData.question_ids.filter((x) => x !== q.id);
                            setFormData({ ...formData, question_ids: next });
                          }}
                          style={{ width: "18px", height: "18px", accentColor: "#00684A", cursor: "pointer" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "#111827", fontSize: "1rem", marginBottom: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {q.title}
                          </div>
                          <div style={{ fontSize: "0.8rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ 
                              padding: "0.15rem 0.5rem", borderRadius: "0.25rem", fontWeight: 600, textTransform: "capitalize",
                              backgroundColor: q.difficulty === 'easy' ? "#D1FAE5" : q.difficulty === 'medium' ? "#FEF3C7" : "#FEE2E2",
                              color: q.difficulty === 'easy' ? "#059669" : q.difficulty === 'medium' ? "#D97706" : "#DC2626"
                            }}>
                              {q.difficulty}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
              onClick={() => router.push("/dsa/tests")}
              style={{ 
                padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#4B5563",
                backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "9999px",
                cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; e.currentTarget.style.borderColor = "#9CA3AF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
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
              {loading ? "Updating..." : "Update DSA Competency Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}