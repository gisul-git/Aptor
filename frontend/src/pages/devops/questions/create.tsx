import { useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  Bot,
  PenTool,
  Sparkles,
  Server,
  BookOpen,
} from "lucide-react";
import {
  buildDevOpsAIGeneratedPayload,
  type DevopsDifficulty,
  type DevopsFocusArea,
} from "@/lib/devops/ai-question-generator";

type QuestionMode = "ai" | "manual";

export default function DevOpsQuestionCreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<QuestionMode>("ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [yearsOfExperience, setYearsOfExperience] = useState("2");
  const [difficulty, setDifficulty] = useState<DevopsDifficulty>("intermediate");
  const [topicsRequired, setTopicsRequired] = useState("CI/CD pipelines, Docker, Kubernetes");
  const [questionCount, setQuestionCount] = useState(3);
  const [jobRole, setJobRole] = useState("DevOps Engineer");
  const [timeLimit, setTimeLimit] = useState(60);
  const [focusArea, setFocusArea] = useState<DevopsFocusArea>("balanced");

  const [manualTitle, setManualTitle] = useState("Create a resilient CI/CD workflow");
  const [manualDescription, setManualDescription] = useState(
    "Design a production-safe CI/CD pipeline with environment separation and rollback readiness."
  );
  const [manualDifficulty, setManualDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [manualStarterCode, setManualStarterCode] = useState("# Write your solution here");

  const handleGenerateAI = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = buildDevOpsAIGeneratedPayload({
        yearsOfExperience,
        difficulty,
        topicsRequired,
        questionCount,
        jobRole,
        timeLimit,
        focusArea,
      });
      sessionStorage.setItem("devopsAIGeneratedPayload", JSON.stringify(payload));
      sessionStorage.setItem(
        "devopsAIGenerationMeta",
        JSON.stringify({
          source: "create-page",
          yearsOfExperience,
          difficulty,
          topicsRequired,
          questionCount,
          jobRole,
          timeLimit,
          focusArea,
          generatedAt: new Date().toISOString(),
        })
      );
      router.push("/devops/tests/ai-generated/take?generated=1");
    } catch (err: any) {
      setError(err?.message || "Failed to generate questions.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualContinue = async () => {
    setLoading(true);
    setError(null);
    try {
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
        questions: [
          {
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
          },
        ],
      };
      sessionStorage.setItem("devopsAIGeneratedPayload", JSON.stringify(payload));
      sessionStorage.setItem(
        "devopsAIGenerationMeta",
        JSON.stringify({ source: "manual-form", generatedAt: new Date().toISOString() })
      );
      router.push("/devops/tests/ai-generated/take?generated=1");
    } catch (err: any) {
      setError(err?.message || "Failed to continue with manual question.");
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
          Choose AI generation or manual authoring with Aptor-style workflow.
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
                <input value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
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
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Question Count</div>
                <input type="number" min={1} max={10} value={questionCount} onChange={(e) => setQuestionCount(Math.max(1, Number(e.target.value || 1)))} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
              </label>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Time Limit (mins)</div>
                <input type="number" min={10} value={timeLimit} onChange={(e) => setTimeLimit(Math.max(10, Number(e.target.value || 60)))} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }} />
              </label>
              <label>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Focus Area</div>
                <select value={focusArea} onChange={(e) => setFocusArea(e.target.value as DevopsFocusArea)} style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}>
                  <option value="balanced">Balanced</option>
                  <option value="practical">Practical</option>
                  <option value="conceptual">Conceptual</option>
                </select>
              </label>
            </div>
            <label style={{ display: "block", marginTop: "1rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Topics Required</div>
              <textarea
                rows={4}
                value={topicsRequired}
                onChange={(e) => setTopicsRequired(e.target.value)}
                style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", resize: "vertical" }}
              />
            </label>
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
      </div>
    </div>
  );
}

