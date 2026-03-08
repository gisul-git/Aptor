import { useState } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, BookOpen, Bot, PenTool, Server, Sparkles } from "lucide-react";
import { type DevopsDifficulty } from "@/lib/cloud/ai-question-generator";

type QuestionMode = "ai" | "manual";

type QuestionLike = Record<string, any>;

type CloudRole =
  | "Cloud Engineer"
  | "Cloud DevOps Engineer"
  | "Cloud Architect"
  | "Site Reliability Engineer (Cloud)"
  | "Platform Engineer"
  | "Cloud Security Engineer"
  | "Cloud Network Engineer"
  | "Cloud Systems Administrator"
  | "Cloud Operations Engineer"
  | "Cloud Migration Engineer"
  | "Kubernetes Platform Engineer"
  | "Cloud Data Engineer"
  | "MLOps Engineer"
  | "FinOps Analyst"
  | "Solutions Architect (Cloud)"
  | "Cloud Automation Engineer"
  | "Other";

const DEFAULT_CLOUD_TOPICS_BY_DIFFICULTY: Record<DevopsDifficulty, string[]> = {
  beginner: [
    "Cloud IAM basics and access boundaries",
    "Basic object storage and lifecycle policies",
    "Compute instance setup and tagging standards",
    "Cloud monitoring and alerting fundamentals",
  ],
  intermediate: [
    "Multi-environment infrastructure configuration",
    "Container orchestration deployment strategies",
    "Cloud networking segmentation and routing",
    "Infrastructure policy validation workflows",
  ],
  advanced: [
    "Disaster recovery and regional failover design",
    "Zero-trust cloud security hardening",
    "Cloud cost optimization and governance automation",
    "Large-scale reliability incident response",
  ],
};

const ROLE_TOPIC_MAP: Record<Exclude<CloudRole, "Other">, Record<DevopsDifficulty, string[]>> = {
  "Cloud Engineer": {
    beginner: ["IAM users and roles", "Object storage versioning", "Basic virtual network setup"],
    intermediate: ["Autoscaling policies", "Managed database backup strategies", "Infrastructure drift detection"],
    advanced: ["Cross-region resilience", "High-availability architecture", "Cloud governance guardrails"],
  },
  "Cloud DevOps Engineer": {
    beginner: ["Build pipeline fundamentals", "Artifact registry workflows", "Environment variable management"],
    intermediate: ["Progressive delivery patterns", "Pipeline security scanning", "Infrastructure CI validation"],
    advanced: ["Multi-account release orchestration", "Policy-as-code enforcement", "Automated rollback strategies"],
  },
  "Cloud Architect": {
    beginner: ["Reference architecture baselines", "Service boundary definitions", "Resource naming standards"],
    intermediate: ["Multi-tier network architecture", "Data durability design", "Identity federation patterns"],
    advanced: ["Landing zone architecture", "Cross-region active-active design", "Platform governance models"],
  },
  "Site Reliability Engineer (Cloud)": {
    beginner: ["SLI and SLO basics", "Service health dashboards", "Alert threshold tuning"],
    intermediate: ["Incident playbook automation", "Capacity forecasting", "Reliability error budget tracking"],
    advanced: ["Chaos engineering in cloud systems", "Multi-region failure recovery", "Reliability architecture audits"],
  },
  "Platform Engineer": {
    beginner: ["Internal platform environment setup", "Golden template management", "Developer self-service basics"],
    intermediate: ["Reusable platform modules", "Cluster tenancy and isolation", "Platform observability standards"],
    advanced: ["Organization-wide platform governance", "Scalable self-service infrastructure", "Platform API lifecycle control"],
  },
  "Cloud Security Engineer": {
    beginner: ["Least privilege role setup", "Storage encryption defaults", "Basic security monitoring"],
    intermediate: ["Secret rotation workflows", "Identity threat detection rules", "Network policy hardening"],
    advanced: ["Zero-trust cloud controls", "Security policy automation", "Cross-account incident containment"],
  },
  "Cloud Network Engineer": {
    beginner: ["Subnet and route table basics", "Security groups and ACLs", "Private/public network patterns"],
    intermediate: ["Transit routing architecture", "Hybrid connectivity design", "DNS and load balancing strategy"],
    advanced: ["Global network failover design", "Advanced traffic segmentation", "Network observability at scale"],
  },
  "Cloud Systems Administrator": {
    beginner: ["Instance patching workflows", "User access lifecycle management", "Storage and snapshot basics"],
    intermediate: ["Configuration baseline enforcement", "OS hardening automation", "Operational runbook creation"],
    advanced: ["Fleet-level remediation automation", "Business continuity procedures", "Operational risk controls"],
  },
  "Cloud Operations Engineer": {
    beginner: ["Operational health checks", "Standard incident triage", "Cloud service inventory management"],
    intermediate: ["Runbook-driven operations", "Automated maintenance workflows", "Service ownership tracking"],
    advanced: ["Cross-team incident command", "Operational maturity frameworks", "Enterprise operations governance"],
  },
  "Cloud Migration Engineer": {
    beginner: ["Discovery and dependency mapping", "Migration wave planning", "Initial target environment prep"],
    intermediate: ["Data migration validation", "Cutover and rollback planning", "Hybrid migration orchestration"],
    advanced: ["Large-scale migration governance", "Post-migration optimization", "Risk-led migration program design"],
  },
  "Kubernetes Platform Engineer": {
    beginner: ["Cluster namespace standards", "Workload deployment basics", "Service exposure patterns"],
    intermediate: ["Ingress and traffic policies", "Workload autoscaling", "Cluster security baselines"],
    advanced: ["Multi-cluster operations", "Cluster policy governance", "Platform reliability optimization"],
  },
  "Cloud Data Engineer": {
    beginner: ["Storage tiering and retention", "Managed data service basics", "Data access control setup"],
    intermediate: ["Data pipeline orchestration", "Schema evolution strategy", "Data quality validation"],
    advanced: ["Lakehouse reliability architecture", "Cross-region data replication", "Data platform governance"],
  },
  "MLOps Engineer": {
    beginner: ["Model artifact management", "ML environment configuration", "Experiment tracking setup"],
    intermediate: ["Model deployment pipelines", "Feature store operations", "Inference monitoring setup"],
    advanced: ["Multi-model production governance", "Automated model rollback", "ML reliability and compliance controls"],
  },
  "FinOps Analyst": {
    beginner: ["Cloud cost allocation tagging", "Basic budget alerts", "Resource usage reporting"],
    intermediate: ["Cost anomaly detection", "Commitment planning strategies", "Chargeback model configuration"],
    advanced: ["Enterprise cloud cost governance", "Unit economics optimization", "Multi-account spend controls"],
  },
  "Solutions Architect (Cloud)": {
    beginner: ["Workload requirement mapping", "Service selection rationale", "High-level architecture documentation"],
    intermediate: ["Non-functional requirement design", "Security and compliance architecture", "Scalable reference solutions"],
    advanced: ["Enterprise architecture governance", "Cross-domain solution optimization", "Strategic modernization roadmaps"],
  },
  "Cloud Automation Engineer": {
    beginner: ["Basic automation scripts", "Template parameterization", "Task scheduling fundamentals"],
    intermediate: ["Workflow automation pipelines", "Configuration compliance automation", "Automated environment provisioning"],
    advanced: ["Autonomous operations workflows", "Enterprise automation standards", "Self-healing cloud systems"],
  },
};

async function persistQuestions(questions: QuestionLike[]): Promise<QuestionLike[]> {
  const response = await fetch("/api/cloud/save-questions", {
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

export default function CloudQuestionCreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<QuestionMode>("ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [experienceYears, setExperienceYears] = useState(3);
  const [difficulty, setDifficulty] = useState<DevopsDifficulty>("intermediate");
  const [topicsRequired, setTopicsRequired] = useState("Cloud IAM basics and access boundaries");
  const [jobRole, setJobRole] = useState<CloudRole>("Cloud Engineer");
  const [customJobRole, setCustomJobRole] = useState("");

  const [manualTitle, setManualTitle] = useState("Create a resilient CI/CD workflow");
  const [manualDescription, setManualDescription] = useState(
    "Design a production-safe CI/CD pipeline with environment separation and rollback readiness."
  );
  const [manualDifficulty, setManualDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [manualStarterCode, setManualStarterCode] = useState("# Write your solution here");

  const effectiveYearsOfExperience = `${experienceYears} ${experienceYears === 1 ? "year" : "years"}`;
  const effectiveTopicsRequired = topicsRequired.trim() || "Cloud IAM basics and access boundaries";
  const effectiveJobRole = jobRole === "Other" ? (customJobRole.trim() || "Cloud Engineer") : jobRole;
  const roleTopics =
    jobRole === "Other" ? [] : ROLE_TOPIC_MAP[jobRole as Exclude<CloudRole, "Other">][difficulty];
  const suggestedTopics = Array.from(
    new Set([...DEFAULT_CLOUD_TOPICS_BY_DIFFICULTY[difficulty], ...roleTopics])
  );

  const handleGenerateAI = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      let questions: QuestionLike[] = [];

      try {
        const response = await fetch("/api/cloud/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearsOfExperience: effectiveYearsOfExperience,
            difficulty,
            topicsRequired: effectiveTopicsRequired,
            questionCount: 1,
            jobRole: effectiveJobRole,
            timeLimit: 60,
            focusArea: "balanced",
            title: "Cloud AI Assessment",
            description: "Auto-generated Cloud assessment",
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
          jobRole: effectiveJobRole,
          timeLimit: 60,
          focusArea: "balanced",
        },
        questions: savedQuestions,
      };

      sessionStorage.setItem("cloudAIGeneratedPayload", JSON.stringify(payload));
      sessionStorage.setItem(
        "cloudAIGenerationMeta",
        JSON.stringify({
          source: "create-page",
          yearsOfExperience: effectiveYearsOfExperience,
          difficulty,
          topicsRequired: effectiveTopicsRequired,
          questionCount: 1,
          jobRole: effectiveJobRole,
          timeLimit: 60,
          focusArea: "balanced",
          generatedAt: new Date().toISOString(),
        })
      );
      router.push("/cloud/questions");
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
        id: "manual-cloud-1",
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
          jobRole: "Cloud Engineer",
          timeLimit: 45,
          focusArea: "practical",
        },
        questions: savedQuestions,
      };

      sessionStorage.setItem("cloudAIGeneratedPayload", JSON.stringify(payload));
      sessionStorage.setItem(
        "cloudAIGenerationMeta",
        JSON.stringify({ source: "manual-form", generatedAt: new Date().toISOString() })
      );
      router.push("/cloud/questions");
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
          onClick={() => router.push("/cloud/questions")}
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
          <ArrowLeft size={16} strokeWidth={2.5} /> Cloud Questions
        </button>

        <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2rem", fontWeight: 800 }}>
          Create Cloud Question
        </h1>
        <p style={{ margin: "0 0 2rem 0", color: "#6B7280" }}>
          Create production-focused Cloud questions using AI generation or manual authoring.
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
            <div style={{ color: "#6B7280", fontSize: "0.875rem" }}>Author your own custom Cloud question.</div>
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
                <select
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value as CloudRole)}
                  style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
                >
                  <option>Cloud Engineer</option>
                  <option>Cloud DevOps Engineer</option>
                  <option>Cloud Architect</option>
                  <option>Site Reliability Engineer (Cloud)</option>
                  <option>Platform Engineer</option>
                  <option>Cloud Security Engineer</option>
                  <option>Cloud Network Engineer</option>
                  <option>Cloud Systems Administrator</option>
                  <option>Cloud Operations Engineer</option>
                  <option>Cloud Migration Engineer</option>
                  <option>Kubernetes Platform Engineer</option>
                  <option>Cloud Data Engineer</option>
                  <option>MLOps Engineer</option>
                  <option>FinOps Analyst</option>
                  <option>Solutions Architect (Cloud)</option>
                  <option>Cloud Automation Engineer</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            {jobRole === "Other" && (
              <label style={{ display: "block", marginTop: "1rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Custom Job Role</div>
                <input
                  value={customJobRole}
                  onChange={(e) => setCustomJobRole(e.target.value)}
                  placeholder="Enter cloud role"
                  style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
                />
              </label>
            )}
            <label style={{ display: "block", marginTop: "1rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.4rem" }}>Topics Required</div>
              <input
                value={topicsRequired}
                onChange={(e) => setTopicsRequired(e.target.value)}
                placeholder="Enter cloud topic or pick a suggestion below"
                style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
              />
            </label>
            <div style={{ marginTop: "0.8rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#6B7280", fontWeight: 600, marginBottom: "0.45rem" }}>
                Suggested topics for {effectiveJobRole} ({difficulty})
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

