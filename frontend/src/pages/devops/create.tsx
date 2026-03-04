import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, Plus, ShieldCheck, CalendarClock, Users, ListChecks, Settings, Trash2 } from "lucide-react";
import { buildDevOpsAIGeneratedPayload } from "@/lib/devops/ai-question-generator";

type ExamMode = "strict" | "flexible";
type TimerMode = "GLOBAL" | "PER_QUESTION";
type CustomKind = "command" | "terraform" | "lint";

interface CustomQuestion {
  id: string;
  title: string;
  description: string;
  kind: CustomKind;
  difficulty: "easy" | "medium" | "hard";
  starterCode: string;
}

export default function DevOpsCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(true);
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState(false);
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false);

  const [requirePhone, setRequirePhone] = useState(false);
  const [requireResume, setRequireResume] = useState(false);
  const [requireLinkedIn, setRequireLinkedIn] = useState(false);
  const [requireGithub, setRequireGithub] = useState(false);

  const [examMode, setExamMode] = useState<ExamMode>("strict");
  const [timerMode, setTimerMode] = useState<TimerMode>("GLOBAL");

  const [formData, setFormData] = useState({
    title: "DevOps AI Assessment",
    description: "A generated DevOps assessment with customizable constraints and proctoring controls.",
    yearsOfExperience: "2-4",
    difficulty: "intermediate",
    topicsRequired: "CI/CD pipelines, Docker, Kubernetes, Terraform, Monitoring",
    questionCount: 10,
    jobRole: "DevOps Engineer",
    focusArea: "balanced",
    duration_minutes: 60,
    start_time: "",
    end_time: "",
  });

  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomQuestion>({
    id: "",
    title: "",
    description: "",
    kind: "command",
    difficulty: "medium",
    starterCode: "",
  });

  const basePreviewQuestions = useMemo(() => {
    const generated = buildDevOpsAIGeneratedPayload({
      yearsOfExperience: formData.yearsOfExperience,
      difficulty: formData.difficulty as "beginner" | "intermediate" | "advanced",
      topicsRequired: formData.topicsRequired,
      questionCount: formData.questionCount,
      jobRole: formData.jobRole,
      timeLimit: formData.duration_minutes,
      focusArea: formData.focusArea as "balanced" | "practical" | "conceptual",
    });
    return generated.questions;
  }, [formData]);

  const addCustomQuestion = () => {
    if (!customDraft.title.trim() || !customDraft.description.trim()) {
      alert("Please provide title and description for custom question.");
      return;
    }
    const question: CustomQuestion = {
      ...customDraft,
      id: `custom-${Date.now()}`,
      starterCode: customDraft.starterCode || (customDraft.kind === "terraform"
        ? 'terraform {\n  required_version = ">= 1.3.0"\n}\n\nresource "null_resource" "example" {}\n'
        : customDraft.kind === "lint"
          ? "FROM alpine:3.20\nRUN echo \"ready\"\n"
          : "echo \"your command\""),
    };
    setCustomQuestions((prev) => [...prev, question]);
    setCustomDraft({
      id: "",
      title: "",
      description: "",
      kind: "command",
      difficulty: "medium",
      starterCode: "",
    });
  };

  const removeCustomQuestion = (id: string) => {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const totalQuestions = basePreviewQuestions.length + customQuestions.length;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerationError(null);

    if (!formData.start_time) {
      alert("Start time is required.");
      return;
    }
    if (examMode === "flexible" && !formData.end_time) {
      alert("End time is required for flexible mode.");
      return;
    }
    if (examMode === "flexible" && new Date(formData.start_time) >= new Date(formData.end_time)) {
      alert("End time must be after start time.");
      return;
    }

    setLoading(true);
    try {
      const aiResponse = await fetch("/api/devops/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearsOfExperience: formData.yearsOfExperience,
          difficulty: formData.difficulty,
          topicsRequired: formData.topicsRequired,
          questionCount: formData.questionCount,
          jobRole: formData.jobRole,
          timeLimit: formData.duration_minutes,
          focusArea: formData.focusArea,
          title: formData.title,
          description: formData.description,
        }),
      });

      const aiJson = await aiResponse.json().catch(() => null);
      if (!aiResponse.ok) {
        const reason = aiJson?.error || aiJson?.details || "AI question generation failed.";
        setGenerationError(String(reason));
        return;
      }
      if (!Array.isArray(aiJson?.questions) || aiJson.questions.length === 0) {
        setGenerationError("AI returned no questions. Please refine topics and try again.");
        return;
      }

      const generated = {
        generatedAt: new Date().toISOString(),
        source: "ai-form",
        metadata: {
          yearsOfExperience: formData.yearsOfExperience,
          difficulty: formData.difficulty,
          topicsRequired: formData.topicsRequired,
          questionCount: formData.questionCount,
          jobRole: formData.jobRole,
          timeLimit: formData.duration_minutes,
          focusArea: formData.focusArea,
        },
        questions: aiJson.questions,
      };

      const mappedCustom = customQuestions.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        points: 10,
        kind: q.kind,
        starterCode: q.starterCode,
        validationMode: q.kind === "lint" ? "runtime" : "hybrid",
        instructions: ["Solve this custom question using DevOps best practices."],
        constraints: ["Keep solution executable and safe."],
        hints: ["Start simple, then refine."],
      }));

      const finalPayload = {
        ...generated,
        title: formData.title,
        description: formData.description,
        questions: [...generated.questions, ...mappedCustom],
      };

      const creationMeta = {
        title: formData.title,
        description: formData.description,
        timerMode,
        examMode,
        duration: formData.duration_minutes,
        schedule: {
          startTime: new Date(formData.start_time).toISOString(),
          ...(examMode === "flexible" && formData.end_time ? { endTime: new Date(formData.end_time).toISOString() } : {}),
        },
        proctoringSettings: {
          aiProctoringEnabled,
          faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false,
          liveProctoringEnabled,
        },
        candidateRequirements: {
          requirePhone,
          requireResume,
          requireLinkedIn,
          requireGithub,
        },
      };

      sessionStorage.setItem("devopsAIGeneratedPayload", JSON.stringify(finalPayload));
      sessionStorage.setItem("devopsAIGenerationMeta", JSON.stringify(creationMeta));

      await router.push("/devops/tests/ai-generated/take?generated=1");
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
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent", border: "none", fontWeight: 600, cursor: "pointer" }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
            Create DevOps AI Assessment
          </h1>
          <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
            AIML-style creation flow with proctoring, schedule controls, candidate requirements, and custom questions.
          </p>
        </div>

        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {generationError && (
            <div
              style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#B91C1C",
                padding: "0.9rem 1rem",
                borderRadius: "0.5rem",
                fontWeight: 600,
              }}
            >
              {generationError}
            </div>
          )}
          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <Settings size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Basic Information</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Assessment title" />
              <input value={formData.jobRole} onChange={(e) => setFormData({ ...formData, jobRole: e.target.value })} placeholder="Job role" />
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description"
              style={{ marginTop: "1rem", minHeight: "90px" }}
            />
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <ListChecks size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>AI Generation Settings</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "1rem" }}>
              <select value={formData.yearsOfExperience} onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}>
                <option value="0-2">0-2 Years</option>
                <option value="2-4">2-4 Years</option>
                <option value="4-7">4-7 Years</option>
                <option value="7+">7+ Years</option>
              </select>
              <select value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <select value={formData.focusArea} onChange={(e) => setFormData({ ...formData, focusArea: e.target.value })}>
                <option value="balanced">Balanced</option>
                <option value="practical">Practical Heavy</option>
                <option value="conceptual">Conceptual Heavy</option>
              </select>
              <input type="number" min={1} max={40} value={formData.questionCount} onChange={(e) => setFormData({ ...formData, questionCount: Math.max(1, Number(e.target.value || 1)) })} placeholder="Question count" />
              <input type="number" min={10} max={180} value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: Math.max(10, Number(e.target.value || 10)) })} placeholder="Duration (mins)" />
              <select value={timerMode} onChange={(e) => setTimerMode(e.target.value as TimerMode)}>
                <option value="GLOBAL">Global Timer</option>
                <option value="PER_QUESTION">Per Question Timer</option>
              </select>
            </div>
            <textarea
              value={formData.topicsRequired}
              onChange={(e) => setFormData({ ...formData, topicsRequired: e.target.value })}
              placeholder="Topics Required (comma separated)"
              style={{ marginTop: "1rem", minHeight: "90px" }}
            />
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <ShieldCheck size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Proctoring Settings</h2>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={aiProctoringEnabled} onChange={(e) => setAiProctoringEnabled(e.target.checked)} />
              Enable AI Proctoring
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", marginLeft: "1.5rem" }}>
              <input type="checkbox" checked={faceMismatchEnabled} disabled={!aiProctoringEnabled} onChange={(e) => setFaceMismatchEnabled(e.target.checked)} />
              Face Mismatch Detection
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <input type="checkbox" checked={liveProctoringEnabled} onChange={(e) => setLiveProctoringEnabled(e.target.checked)} />
              Enable Live Proctoring
            </label>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <CalendarClock size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Scheduling & Exam Window</h2>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <label><input type="radio" checked={examMode === "strict"} onChange={() => setExamMode("strict")} /> Strict</label>
              <label><input type="radio" checked={examMode === "flexible"} onChange={() => setExamMode("flexible")} /> Flexible</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: examMode === "strict" ? "1fr" : "1fr 1fr", gap: "1rem" }}>
              <input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
              {examMode === "flexible" && (
                <input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
              )}
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <Users size={20} color="#00684A" />
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Candidate Requirements</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <label><input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} /> Phone</label>
              <label><input type="checkbox" checked={requireResume} onChange={(e) => setRequireResume(e.target.checked)} /> Resume</label>
              <label><input type="checkbox" checked={requireLinkedIn} onChange={(e) => setRequireLinkedIn(e.target.checked)} /> LinkedIn</label>
              <label><input type="checkbox" checked={requireGithub} onChange={(e) => setRequireGithub(e.target.checked)} /> GitHub</label>
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "2rem", borderRadius: "1rem", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ListChecks size={20} color="#00684A" />
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Question Selection</h2>
              </div>
              <span style={{ fontWeight: 700, color: "#00684A" }}>{totalQuestions} Total Questions</span>
            </div>

            <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: "#F9FAFB" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#111827" }}>Add Customized Question</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <input value={customDraft.title} onChange={(e) => setCustomDraft({ ...customDraft, title: e.target.value })} placeholder="Custom question title" />
                <select value={customDraft.kind} onChange={(e) => setCustomDraft({ ...customDraft, kind: e.target.value as CustomKind })}>
                  <option value="command">Command</option>
                  <option value="terraform">Terraform</option>
                  <option value="lint">Lint</option>
                </select>
                <select value={customDraft.difficulty} onChange={(e) => setCustomDraft({ ...customDraft, difficulty: e.target.value as "easy" | "medium" | "hard" })}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <textarea value={customDraft.description} onChange={(e) => setCustomDraft({ ...customDraft, description: e.target.value })} placeholder="Custom question description" style={{ minHeight: "80px", marginBottom: "0.75rem" }} />
              <textarea value={customDraft.starterCode} onChange={(e) => setCustomDraft({ ...customDraft, starterCode: e.target.value })} placeholder="Starter code (optional)" style={{ minHeight: "80px", marginBottom: "0.75rem" }} />
              <button type="button" onClick={addCustomQuestion} style={{ padding: "0.6rem 0.9rem", background: "#F0F9F4", border: "1px solid #C9F4D4", borderRadius: "0.5rem", color: "#00684A", fontWeight: 600 }}>
                <Plus size={16} style={{ verticalAlign: "middle" }} /> Add Custom Question
              </button>
            </div>

            <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: "#ffffff", maxHeight: "320px", overflowY: "auto" }}>
              {customQuestions.length === 0 ? (
                <div style={{ padding: "1rem", color: "#6B7280", fontSize: "0.9rem" }}>No custom questions added yet.</div>
              ) : (
                customQuestions.map((q) => (
                  <div key={q.id} style={{ padding: "0.85rem 1rem", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#111827" }}>{q.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>{q.kind} • {q.difficulty}</div>
                    </div>
                    <button type="button" onClick={() => removeCustomQuestion(q.id)} style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ position: "sticky", bottom: 0, backgroundColor: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(6px)", borderTop: "1px solid #E5E7EB", padding: "1rem 0", display: "flex", gap: "0.75rem" }}>
            <button type="button" onClick={() => router.push("/devops")} style={{ flex: 1, padding: "0.95rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", background: "#fff", fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: "0.95rem", border: "none", borderRadius: "0.5rem", background: "#00684A", color: "#fff", fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Generating..." : "Generate & Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
