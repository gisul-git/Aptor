export type DevopsDifficulty = "beginner" | "intermediate" | "advanced";
export type DevopsFocusArea = "balanced" | "practical" | "conceptual";

export interface DevOpsAIGenerationInput {
  yearsOfExperience: string;
  difficulty: DevopsDifficulty;
  topicsRequired: string;
  questionCount: number;
  jobRole: string;
  timeLimit: number;
  focusArea: DevopsFocusArea;
}

export interface GeneratedDevOpsQuestion {
  [key: string]: unknown;
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  kind: "command" | "terraform" | "lint";
  lintType?: "docker" | "kubernetes" | "github_actions";
  terraformAction?: "init" | "plan" | "apply" | "destroy";
  starterCode: string;
  validationMode: "runtime" | "content" | "hybrid";
  expectedSubmissionContains?: string[];
  expectedSubmissionRegex?: string;
  expectedExitCode?: number;
  expectedStdoutRegex?: string;
  minLintScore?: number;
  instructions: string[];
  constraints: string[];
  hints: string[];
}

export interface GeneratedDevOpsPayload {
  generatedAt: string;
  source: "ai-form";
  metadata: DevOpsAIGenerationInput;
  questions: GeneratedDevOpsQuestion[];
}

const TERRAFORM_STARTER =
  'terraform {\n  required_version = ">= 1.3.0"\n}\n\nresource "null_resource" "example" {}\n';

function toRuntimeDifficulty(level: DevopsDifficulty): "easy" | "medium" | "hard" {
  if (level === "beginner") return "easy";
  if (level === "advanced") return "hard";
  return "medium";
}

function normalizeTopics(raw: string): string[] {
  return raw
    .split(/[,\n]/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function pickKind(index: number, focusArea: DevopsFocusArea): "command" | "terraform" | "lint" {
  const practicalCycle: Array<"command" | "terraform" | "lint"> = ["command", "terraform", "command", "lint"];
  const conceptualCycle: Array<"command" | "terraform" | "lint"> = ["lint", "lint", "command", "terraform"];
  const balancedCycle: Array<"command" | "terraform" | "lint"> = ["command", "terraform", "lint"];
  const cycle = focusArea === "practical" ? practicalCycle : focusArea === "conceptual" ? conceptualCycle : balancedCycle;
  return cycle[index % cycle.length];
}

function lintTypeForTopic(topic: string): "docker" | "kubernetes" | "github_actions" {
  const t = topic.toLowerCase();
  if (t.includes("kubernetes") || t.includes("k8s") || t.includes("helm")) return "kubernetes";
  if (t.includes("github actions") || t.includes("workflow") || t.includes("ci")) return "github_actions";
  return "docker";
}

function starterFor(kind: "command" | "terraform" | "lint", topic: string): string {
  if (kind === "terraform") return TERRAFORM_STARTER;
  if (kind === "lint") {
    const lintType = lintTypeForTopic(topic);
    if (lintType === "kubernetes") {
      return "apiVersion: v1\nkind: Pod\nmetadata:\n  name: app\nspec:\n  containers:\n    - name: app\n      image: nginx:stable-alpine\n";
    }
    if (lintType === "github_actions") {
      return "name: CI\non: [push]\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"lint\"\n";
    }
    return "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"npm\", \"start\"]\n";
  }
  return `# ${topic}\n# Write a single shell command below\n`;
}

export function buildDevOpsAIGeneratedPayload(input: DevOpsAIGenerationInput): GeneratedDevOpsPayload {
  const topics = normalizeTopics(input.topicsRequired);
  const fallbackTopics = topics.length ? topics : ["CI/CD pipelines", "Docker", "Kubernetes"];
  const difficulty = toRuntimeDifficulty(input.difficulty);
  const totalQuestions = Math.max(1, Math.min(40, Number(input.questionCount) || 1));
  const pointsPerQuestion = Math.max(5, Math.round(100 / totalQuestions));

  const questions: GeneratedDevOpsQuestion[] = Array.from({ length: totalQuestions }).map((_, idx) => {
    const topic = fallbackTopics[idx % fallbackTopics.length];
    const kind = pickKind(idx, input.focusArea);
    const title = `${topic}: ${kind === "command" ? "Operational Command Task" : kind === "terraform" ? "Terraform Validation Task" : "Lint and Policy Task"}`;

    const base: GeneratedDevOpsQuestion = {
      id: `ai-devops-${idx + 1}`,
      title,
      description: `Role: ${input.jobRole}. Experience: ${input.yearsOfExperience}. Create a ${kind} solution for "${topic}" at ${input.difficulty} level.`,
      difficulty,
      points: pointsPerQuestion,
      kind,
      starterCode: starterFor(kind, topic),
      validationMode: kind === "lint" ? "runtime" : "hybrid",
      instructions: [
        `Solve this ${kind} task for topic "${topic}".`,
        "Use production-safe conventions and clear formatting.",
        "Run and verify output before final submission.",
      ],
      constraints: [
        "Keep the answer executable in the assessment sandbox.",
        "Avoid destructive operations or external credentials.",
      ],
      hints: [
        "Start with a minimal valid solution first, then improve.",
        `Match the expected level: ${input.difficulty}.`,
      ],
    };

    if (kind === "command") {
      return {
        ...base,
        expectedExitCode: 0,
        expectedStdoutRegex: ".+",
      };
    }

    if (kind === "terraform") {
      return {
        ...base,
        terraformAction: "plan",
        validationMode: "runtime",
        expectedExitCode: 0,
      };
    }

    const lintType = lintTypeForTopic(topic);
    return {
      ...base,
      lintType,
      minLintScore: input.difficulty === "advanced" ? 90 : input.difficulty === "intermediate" ? 80 : 70,
      expectedSubmissionContains:
        lintType === "docker"
          ? ["FROM", "WORKDIR", "COPY", "CMD"]
          : lintType === "kubernetes"
            ? ["apiVersion", "kind", "metadata", "spec"]
            : ["name:", "jobs:", "steps:"],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "ai-form",
    metadata: input,
    questions,
  };
}
