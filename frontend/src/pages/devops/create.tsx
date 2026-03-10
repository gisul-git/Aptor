import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  ShieldCheck,
  Settings,
  CalendarClock,
  ListChecks,
  Server,
  Bot,
} from "lucide-react";
import apiClient from "@/services/api/client";

type Difficulty = "easy" | "medium" | "hard";
type QuestionKind = "command" | "terraform" | "lint";

interface DevOpsQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  points: number;
  ai_generated?: boolean;
  is_published?: boolean;
}

function normalizeDifficulty(value: string): Difficulty {
  const lowered = String(value || "").toLowerCase();
  if (lowered === "beginner") return "easy";
  if (lowered === "intermediate") return "medium";
  if (lowered === "advanced") return "hard";
  if (lowered === "easy" || lowered === "medium" || lowered === "hard") return lowered;
  return "medium";
}

function normalizeKind(value: string): QuestionKind {
  const lowered = String(value || "").toLowerCase();
  if (lowered === "command" || lowered === "terraform" || lowered === "lint") return lowered;
  return "command";
}

export default function DevOpsCreateAssessmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  type TimerMode = "GLOBAL" | "PER_QUESTION";
  const [timerMode, setTimerMode] = useState<TimerMode>("GLOBAL");
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>({});
  type ExamMode = "strict" | "flexible";
  const [examMode, setExamMode] = useState<ExamMode>("strict");

  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(true);
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState(false);
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false);

  const [questions, setQuestions] = useState<DevOpsQuestion[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    duration_minutes: 60,
    start_time: "",
    end_time: "",
    question_ids: [] as string[],
  });

  useEffect(() => {
    const loadPublishedQuestions = async () => {
      try {
        const response = await apiClient.get("/api/v1/devops/questions/published");
        const rows = response?.data?.data || [];
        if (!Array.isArray(rows)) {
          setQuestions([]);
          return;
        }

        const publishedQuestions: DevOpsQuestion[] = rows.map((item: any, idx: number) => ({
          id: String(item.question_id || item.id || item._id || `published-devops-${idx + 1}`),
          title: String(item.title || `Published DevOps Question ${idx + 1}`),
          description: String(item.description || "Published DevOps question."),
          difficulty: normalizeDifficulty(String(item.difficulty || "medium")),
          kind: normalizeKind(String(item.kind || "command")),
          points: Number(item.points || 10),
          ai_generated: Boolean(item.ai_generated),
          is_published: Boolean(item.is_published),
        }));

        setQuestions(publishedQuestions);
      } catch {
        setQuestions([]);
      }
    };

    loadPublishedQuestions();
  }, []);

  const selectedQuestions = useMemo(
    () => questions.filter((q) => formData.question_ids.includes(q.id)),
    [questions, formData.question_ids]
  );

  const toggleQuestion = (questionId: string) => {
    setFormData((prev) => {
      const exists = prev.question_ids.includes(questionId);
      const nextIds = exists
        ? prev.question_ids.filter((id) => id !== questionId)
        : [...prev.question_ids, questionId];
      return { ...prev, question_ids: nextIds };
    });
    setQuestionTimings((prev) => {
      const next = { ...prev };
      if (formData.question_ids.includes(questionId)) {
        delete next[questionId];
      } else {
        next[questionId] = 10;
      }
      return next;
    });
  };

  const updateQuestionTiming = (questionId: string, minutes: number) => {
    setQuestionTimings((prev) => ({ ...prev, [questionId]: Math.max(1, minutes) }));
  };

  const calculateTotalDuration = (): number => {
    return formData.question_ids.reduce((total, qid) => total + (questionTimings[qid] || 10), 0);
  };

  const getDifficultyColor = (difficulty: Difficulty) => {
    if (difficulty === "easy") return { fg: "#059669", bg: "#D1FAE5" };
    if (difficulty === "hard") return { fg: "#DC2626", bg: "#FEE2E2" };
    return { fg: "#D97706", bg: "#FEF3C7" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.question_ids.length === 0) {
      alert("Select at least one question.");
      return;
    }

    if (examMode === "strict") {
      if (!formData.start_time) {
        alert("Start time is required for strict mode.");
        return;
      }
      const durationForSchedule =
        timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;
      if (!durationForSchedule || durationForSchedule < 1) {
        alert("Duration is required for strict mode.");
        return;
      }
    } else {
      if (!formData.start_time || !formData.end_time) {
        alert("Start and End time are required for flexible mode.");
        return;
      }
      if (new Date(formData.start_time) >= new Date(formData.end_time)) {
        alert("End time must be after start time.");
        return;
      }
    }

    if (timerMode === "PER_QUESTION") {
      for (const qid of formData.question_ids) {
        if (!questionTimings[qid] || questionTimings[qid] < 1) {
          alert("Please set valid per-question durations.");
          return;
        }
      }
    }

    setLoading(true);
    try {
      const durationForSchedule =
        timerMode === "PER_QUESTION" ? calculateTotalDuration() : formData.duration_minutes;
      const payload = {
        title: formData.title,
        description: formData.description,
        duration: durationForSchedule,
        start_time: formData.start_time || null,
        ...(examMode === "flexible" ? { end_time: formData.end_time || null } : {}),
        question_ids: selectedQuestions.map((q) => q.id),
        examMode,
        timer_mode: timerMode,
        schedule: {
          startTime: formData.start_time || null,
          ...(examMode === "flexible" ? { endTime: formData.end_time || null } : {}),
          duration: durationForSchedule,
        },
        proctoringSettings: {
          aiProctoringEnabled,
          faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false,
          liveProctoringEnabled,
        },
        ...(timerMode === "PER_QUESTION"
          ? {
              question_timings: formData.question_ids.map((qid) => ({
                question_id: qid,
                duration_minutes: questionTimings[qid] || 10,
              })),
              duration_minutes: durationForSchedule,
            }
          : { duration_minutes: formData.duration_minutes }),
      };

      const createResponse = await fetch("/api/devops/create-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseData = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(responseData?.error || "Failed to create assessment.");
      }
      const testData = responseData?.data || responseData;
      const apiId = testData?.id || testData?._id;
      if (!apiId) {
        throw new Error("Failed to create assessment in DB.");
      }
      const createdTestId = String(apiId);

      const localGeneratedPayload = {
        generatedAt: new Date().toISOString(),
        source: "devops-create-page",
        metadata: {
          title: formData.title,
          duration: formData.duration_minutes,
          schedule: {
            startTime: formData.start_time,
            endTime: formData.end_time,
          },
          examMode,
          timerMode,
          questionTimings,
          proctoring: {
            aiProctoringEnabled,
            faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false,
            liveProctoringEnabled,
          },
        },
        questions: selectedQuestions.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          points: q.points,
          kind: q.kind,
          starterCode: "# Write solution here",
          validationMode: "hybrid",
          instructions: ["Solve using production-safe conventions."],
          constraints: ["Avoid destructive operations."],
          hints: ["Start with a minimal valid solution."],
        })),
      };

      sessionStorage.setItem("devopsAIGeneratedPayload", JSON.stringify(localGeneratedPayload));
      sessionStorage.setItem(
        "devopsAIGenerationMeta",
        JSON.stringify({ source: "devops-create-page", generatedAt: new Date().toISOString() })
      );

      router.push(`/devops/tests?testId=${encodeURIComponent(createdTestId)}`);
    } catch (err: any) {
      alert(err?.message || "Failed to create assessment in DB.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/devops")}
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
            }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> DevOps Dashboard
          </button>
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
            Create DevOps Assessment
          </h1>
          <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
            Configure assessment settings, scheduling, and question selection.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <Settings size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Basic Information</h2>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                Assessment Title <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., DevOps Screening - Platform Team"
                style={{ width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Briefly describe what this assessment measures..."
                style={{ width: "100%", minHeight: "100px", padding: "1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <ShieldCheck size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Proctoring Settings</h2>
            </div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem" }}>
                <input type="checkbox" checked={aiProctoringEnabled} onChange={(e) => setAiProctoringEnabled(e.target.checked)} style={{ accentColor: "#00684A" }} />
                <span style={{ fontWeight: 600, color: "#111827" }}>Enable AI Proctoring</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", marginLeft: "1.5rem" }}>
                <input
                  type="checkbox"
                  checked={faceMismatchEnabled}
                  onChange={(e) => setFaceMismatchEnabled(e.target.checked)}
                  disabled={!aiProctoringEnabled}
                  style={{ accentColor: "#00684A" }}
                />
                <span style={{ fontWeight: 600, color: "#111827" }}>Face Mismatch Detection</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem" }}>
                <input type="checkbox" checked={liveProctoringEnabled} onChange={(e) => setLiveProctoringEnabled(e.target.checked)} style={{ accentColor: "#00684A" }} />
                <span style={{ fontWeight: 600, color: "#111827" }}>Enable Live Proctoring</span>
              </label>
            </div>
          </div>

          <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <CalendarClock size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Scheduling & Timers</h2>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
              <label style={{ flex: 1, padding: "1rem", border: examMode === "strict" ? "2px solid #00684A" : "1px solid #D1D5DB", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: examMode === "strict" ? "#F0F9F4" : "#fff" }}>
                <input type="radio" name="examMode" value="strict" checked={examMode === "strict"} onChange={() => setExamMode("strict")} style={{ marginRight: "0.5rem", accentColor: "#00684A" }} />
                <strong style={{ color: examMode === "strict" ? "#00684A" : "#374151" }}>Fixed Window (Strict)</strong>
              </label>
              <label style={{ flex: 1, padding: "1rem", border: examMode === "flexible" ? "2px solid #00684A" : "1px solid #D1D5DB", borderRadius: "0.5rem", cursor: "pointer", backgroundColor: examMode === "flexible" ? "#F0F9F4" : "#fff" }}>
                <input type="radio" name="examMode" value="flexible" checked={examMode === "flexible"} onChange={() => setExamMode("flexible")} style={{ marginRight: "0.5rem", accentColor: "#00684A" }} />
                <strong style={{ color: examMode === "flexible" ? "#00684A" : "#374151" }}>Flexible Window</strong>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: examMode === "strict" ? "1fr 1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>Start Time</label>
                <input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
              </div>
              {examMode === "flexible" && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>End Time</label>
                  <input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
                </div>
              )}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>Timer Mode</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="radio" name="timerMode" value="GLOBAL" checked={timerMode === "GLOBAL"} onChange={() => setTimerMode("GLOBAL")} style={{ accentColor: "#00684A" }} />
                    <span>Single global timer</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input type="radio" name="timerMode" value="PER_QUESTION" checked={timerMode === "PER_QUESTION"} onChange={() => setTimerMode("PER_QUESTION")} style={{ accentColor: "#00684A" }} />
                    <span>Timer per question</span>
                  </label>
                </div>
              </div>
            </div>

            {(timerMode === "GLOBAL" || formData.question_ids.length < 2) && (
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>Duration (mins)</label>
                <input
                  type="number"
                  min={1}
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: Math.max(1, Number(e.target.value || 1)) })}
                  style={{ width: "100%", maxWidth: "260px", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
                />
              </div>
            )}

            {timerMode === "PER_QUESTION" && formData.question_ids.length >= 1 && (
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#F9FAFB", borderRadius: "0.5rem", border: "1px solid #E5E7EB" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.75rem", color: "#111827" }}>Per-question timings</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedQuestions.map((q) => (
                    <div key={`timing-${q.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.75rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.9rem", color: "#374151" }}>{q.title}</span>
                      <input
                        type="number"
                        min={1}
                        value={questionTimings[q.id] || 10}
                        onChange={(e) => updateQuestionTiming(q.id, Number(e.target.value || 1))}
                        style={{ width: "100%", padding: "0.55rem", border: "1px solid #D1D5DB", borderRadius: "0.45rem" }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "0.75rem", color: "#00684A", fontWeight: 700, fontSize: "0.9rem" }}>
                  Total Duration: {calculateTotalDuration()} mins
                </div>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: "#fff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <ListChecks size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Select Questions</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", maxHeight: "360px", overflowY: "auto" }}>
              {questions.map((q) => {
                const diff = getDifficultyColor(q.difficulty);
                const selected = formData.question_ids.includes(q.id);
                return (
                  <label
                    key={q.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      padding: "0.85rem",
                      border: selected ? "2px solid #00684A" : "1px solid #E5E7EB",
                      borderRadius: "0.5rem",
                      background: selected ? "#F0F9F4" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleQuestion(q.id)} style={{ marginTop: "0.2rem", accentColor: "#00684A" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <strong style={{ color: "#111827" }}>{q.title}</strong>
                        {q.ai_generated && <span style={{ fontSize: "0.7rem", color: "#6D28D9", backgroundColor: "#EDE9FE", border: "1px solid #DDD6FE", borderRadius: "999px", padding: "0.1rem 0.45rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}><Bot size={10} /> AI</span>}
                      </div>
                      <p style={{ margin: "0 0 0.4rem 0", color: "#4B5563", fontSize: "0.85rem" }}>{q.description}</p>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: diff.fg, background: diff.bg, padding: "0.15rem 0.5rem", borderRadius: "0.35rem" }}>{q.difficulty}</span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#00684A", background: "#F0F9F4", padding: "0.15rem 0.5rem", borderRadius: "0.35rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}><Server size={11} /> {q.kind}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: "0.75rem", color: formData.question_ids.length ? "#00684A" : "#6B7280", fontWeight: 700, fontSize: "0.9rem" }}>
              {formData.question_ids.length} Question{formData.question_ids.length !== 1 ? "s" : ""} Selected
            </div>
          </div>

          <div style={{ position: "sticky", bottom: 0, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", paddingTop: "1rem", borderTop: "1px solid #E5E7EB", display: "flex", gap: "1rem" }}>
            <button
              type="button"
              onClick={() => router.push("/devops")}
              style={{ flex: 1, padding: "1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", background: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.question_ids.length === 0}
              style={{
                flex: 2,
                padding: "1rem",
                border: "none",
                borderRadius: "0.5rem",
                background: "#00684A",
                color: "#fff",
                fontWeight: 700,
                cursor: loading || formData.question_ids.length === 0 ? "not-allowed" : "pointer",
                opacity: loading || formData.question_ids.length === 0 ? 0.7 : 1,
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
