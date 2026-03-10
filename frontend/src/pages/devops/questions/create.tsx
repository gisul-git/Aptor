import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, BookOpen, Bot, PenTool, Server, Sparkles } from "lucide-react";
import { type DevopsDifficulty } from "@/lib/devops/ai-question-generator";

type QuestionMode = "ai" | "manual";

type QuestionLike = Record<string, any>;

const SUGGESTED_TOPICS_BY_DIFFICULTY: Record<DevopsDifficulty, string[]> = {
  beginner: [
    "Linux filesystem and permissions",
    "Basic shell scripting",
    "Repository initialization and branching",
    "Simple CI pipeline structure",
    "Basic container build configuration",
  ],
  intermediate: [
    "CI/CD pipelines",
    "Container build optimization",
    "Deployment manifest organization",
    "Infrastructure configuration validation",
    "Release versioning workflow",
  ],
  advanced: [
    "Incident recovery automation",
    "Multi-environment release governance",
    "Policy-as-code validation gates",
    "Scalable platform reliability workflows",
    "Platform security compliance automation",
  ],
};

async function persistQuestions(questions: QuestionLike[]): Promise<QuestionLike[]> {
  const response = await fetch("/api/devops/save-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || "Failed to save questions");
  }
  if (!Array.isArray(data?.savedQuestions)) {
    throw new Error("Invalid save response");
  }
  return data.savedQuestions as QuestionLike[];
}

export default function DevOpsQuestionCreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<QuestionMode>("ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [experienceYears, setExperienceYears] = useState(3);
  const [difficulty, setDifficulty] = useState<DevopsDifficulty>("intermediate");
  const [topicsRequired, setTopicsRequired] = useState("CI/CD pipelines");
  const [jobRole, setJobRole] = useState("DevOps Engineer");
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>(
    SUGGESTED_TOPICS_BY_DIFFICULTY.intermediate
  );

  const [manualTitle, setManualTitle] = useState("Create a resilient CI/CD workflow");
  const [manualDescription, setManualDescription] = useState(
    "Design a production-safe CI/CD pipeline with environment separation and rollback readiness."
  );
  const [manualDifficulty, setManualDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [manualStarterCode, setManualStarterCode] = useState("# Write your solution here");

  const effectiveYearsOfExperience = `${experienceYears} ${experienceYears === 1 ? "year" : "years"}`;
  const effectiveTopicsRequired = topicsRequired.trim() || "CI/CD pipelines";

  useEffect(() => {
    let mounted = true;

    const loadSuggestedTopics = async () => {
      try {
        const response = await fetch(
          `/api/devops/suggested-topics?yearsOfExperience=${experienceYears}&difficulty=${encodeURIComponent(difficulty)}`
        );
        const json = await response.json().catch(() => ({}));
        const topics = json?.data?.topics;
        if (mounted && Array.isArray(topics) && topics.length > 0) {
          setSuggestedTopics(topics.slice(0, 5));
          return;
        }
      } catch (_err) {
        // Fall back to local defaults below.
      }

      if (mounted) {
        setSuggestedTopics(SUGGESTED_TOPICS_BY_DIFFICULTY[difficulty]);
      }
    };

    loadSuggestedTopics();
    return () => {
      mounted = false;
    };
  }, [experienceYears, difficulty]);

  const handleGenerateAI = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      let questions: QuestionLike[] = [];

      try {
        const response = await fetch("/api/devops/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearsOfExperience: effectiveYearsOfExperience,
            difficulty,
            topicsRequired: effectiveTopicsRequired,
            questionCount: 1,
            jobRole,
            timeLimit: 60,
            focusArea: "balanced",
            title: "DevOps AI Assessment",
            description: "Auto-generated DevOps assessment",
          }),
        });
        const json = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(json?.questions) && json.questions.length > 0) {
          questions = json.questions;
        }
        if (questions.length === 0) {
          const details = Array.isArray(json?.details) ? json.details.join(" | ") : json?.details;
          throw new Error(json?.error || details || "Backend returned no questions.");
        }
      } catch (genErr: any) {
        throw new Error(genErr?.message || "Failed to generate questions from backend.");
      }

      const savedQuestions = await persistQuestions(questions);
      const payload = {
        generatedAt: new Date().toISOString(),
        source: "ai-form",
        metadata: {
          yearsOfExperience: effectiveYearsOfExperience,
          difficulty,
          topicsRequired: effectiveTopicsRequired,
          questionCount: 1,
          jobRole,
          timeLimit: 60,
          focusArea: "balanced",
        },
        questions: savedQuestions,
      };

      sessionStorage.setItem("devopsAIGeneratedPayload", JSON.stringify(payload));
      sessionStorage.setItem(
        "devopsAIGenerationMeta",
        JSON.stringify({
          source: "create-page",
          yearsOfExperience: effectiveYearsOfExperience,
          difficulty,
          topicsRequired: effectiveTopicsRequired,
          questionCount: 1,
          jobRole,
          timeLimit: 60,
          focusArea: "balanced",
          generatedAt: new Date().toISOString(),
        })
      );
      router.push("/devops/questions");
    } catch (err: any) {
      setError(err?.message || "Failed to generate and store questions in DB.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualContinue = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const manualQuestion: QuestionLike = {
        id: "manual-devops-1",
        title: manualTitle,
        description: manualDescription,
        difficulty: manualDifficulty,
        points: 30,
        kind: "command",
        starterCode: manualStarterCode,
        validationMode: "hybrid",
        instructions: ["Read the requirement carefully.", "Provide production-safe output."],
        constraints: ["No destructive operations.", "No external credentials."],
        hints: ["Start simple, then refine."],
      };

      const savedQuestions = await persistQuestions([manualQuestion]);
      const payload = {
        generatedAt: new Date().toISOString(),
        source: "manual-form",
        metadata: {
          yearsOfExperience: "manual",
          difficulty: manualDifficulty,
          topicsRequired: "manual",
          questionCount: 1,
          jobRole: "DevOps Engineer",
          timeLimit: 45,
          focusArea: "practical",
        },
        questions: savedQuestions,
      };

      sessionStorage.setItem("devopsAIGeneratedPayload", JSON.stringify(payload));
      sessionStorage.setItem(
        "devopsAIGenerationMeta",
        JSON.stringify({ source: "manual-form", generatedAt: new Date().toISOString() })
      );
      router.push("/devops/questions");
    } catch (err: any) {
      setError(err?.message || "Failed to create and store question in DB.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 2rem" }}>
        <button
          type="button"
          onClick={() => router.push("/devops/questions")}
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
            marginBottom: "1rem",
          }}
        >
          <ArrowLeft size={16} strokeWidth={2.5} /> DevOps Questions
        </button>

        <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2rem", fontWeight: 800 }}>
          Create DevOps Question
        </h1>
        <p style={{ margin: "0 0 2rem 0", color: "#6B7280" }}>
          Create production-focused DevOps questions using AI generation or manual authoring.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => setMode("ai")}
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              border: mode === "ai" ? "2px solid #00684A" : "1px solid #D1D5DB",
              backgroundColor: mode === "ai" ? "#F0F9F4" : "#fff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", color: "#00684A", fontWeight: 700 }}>
              <Bot size={18} /> AI Generation
            </div>
            <div style={{ color: "#6B7280", fontSize: "0.875rem" }}>Generate quality questions automatically.</div>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              border: mode === "manual" ? "2px solid #00684A" : "1px solid #D1D5DB",
              backgroundColor: mode === "manual" ? "#F0F9F4" : "#fff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", color: "#00684A", fontWeight: 700 }}>
              <PenTool size={18} /> Manual Creation
            </div>
            <div style={{ color: "#6B7280", fontSize: "0.875rem" }}>Author your own custom DevOps question.</div>
          </button>
        </div>

        {mode === "ai" ? (
          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Years of Experience</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    type="range"
                    min={0}
                    max={15}
                    step={1}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value || 0))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: "4.5rem", textAlign: "right", fontWeight: 600, color: "#111827" }}>
                    {effectiveYearsOfExperience}
                  </span>
                </div>
              </label>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Difficulty</div>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as DevopsDifficulty)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Job Role</div>
                <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
              </label>
            </div>
            <label style={{ display: "block", marginTop: "1rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Topics Required</div>
              <input
                value={topicsRequired}
                onChange={(e) => setTopicsRequired(e.target.value)}
                placeholder="Enter topic or pick a suggestion below"
                style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
              />
            </label>
            <div style={{ marginTop: "0.8rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#6B7280", fontWeight: 600, marginBottom: "0.45rem" }}>
                Suggested topics for {experienceYears} year{experienceYears === 1 ? "" : "s"} ({difficulty})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setTopicsRequired(topic)}
                    style={{
                      padding: "0.4rem 0.65rem",
                      borderRadius: "999px",
                      border: topicsRequired === topic ? "1px solid #00684A" : "1px solid #D1D5DB",
                      backgroundColor: topicsRequired === topic ? "#ECFDF3" : "#fff",
                      color: topicsRequired === topic ? "#065F46" : "#374151",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={loading}
              style={{
                marginTop: "1rem",
                padding: "0.8rem 1.2rem",
                backgroundColor: "#00684A",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Sparkles size={16} /> {loading ? "Generating..." : "Generate Question"}
            </button>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.8rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Title</div>
              <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
            </label>
            <label style={{ display: "block", marginBottom: "0.8rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Description</div>
              <textarea rows={4} value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Difficulty</div>
                <select value={manualDifficulty} onChange={(e) => setManualDifficulty(e.target.value as "easy" | "medium" | "hard")} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Type</div>
                <div style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", color: "#374151", background: "#F9FAFB" }}>
                  Command
                </div>
              </label>
            </div>
            <label style={{ display: "block", marginTop: "0.8rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <BookOpen size={14} /> Starter Code
              </div>
              <textarea rows={7} value={manualStarterCode} onChange={(e) => setManualStarterCode(e.target.value)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} />
            </label>
            <button
              type="button"
              onClick={handleManualContinue}
              disabled={loading}
              style={{
                marginTop: "1rem",
                padding: "0.8rem 1.2rem",
                backgroundColor: "#00684A",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Server size={16} /> {loading ? "Saving..." : "Create Question"}
            </button>
          </div>
        )}

        {error && <p style={{ color: "#DC2626", marginTop: "1rem", fontWeight: 600 }}>{error}</p>}
        {warning && <p style={{ color: "#B45309", marginTop: "0.5rem", fontWeight: 600 }}>{warning}</p>}
      </div>
    </div>
  );
}
