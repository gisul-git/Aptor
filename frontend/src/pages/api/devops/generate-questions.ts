import type { NextApiRequest, NextApiResponse } from "next";

type DevOpsKind = "command" | "terraform" | "lint";
type DevOpsDifficulty = "easy" | "medium" | "hard";

interface GeneratedQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: DevOpsDifficulty;
  points: number;
  kind: DevOpsKind;
  starterCode: string;
  validationMode: "runtime" | "content" | "hybrid";
  lintType?: "docker" | "kubernetes" | "github_actions";
  terraformAction?: "init" | "plan" | "apply" | "destroy";
  expectedSubmissionContains?: string[];
  expectedSubmissionRegex?: string;
  expectedExitCode?: number;
  expectedStdoutRegex?: string;
  minLintScore?: number;
  instructions: string[];
  constraints: string[];
  hints: string[];
}

function extractJsonObject(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  return JSON.parse(slice);
}

function asDifficulty(value: unknown): DevOpsDifficulty {
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return "medium";
}

function asKind(value: unknown): DevOpsKind {
  if (value === "command" || value === "terraform" || value === "lint") return value;
  return "command";
}

function sanitizeQuestions(raw: unknown, count: number): GeneratedQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, Math.max(1, Math.min(40, count))).map((item, idx) => {
    const q = (item || {}) as Record<string, unknown>;
    const kind = asKind(q.kind);
    const difficulty = asDifficulty(q.difficulty);
    return {
      id: String(q.id || `ai-devops-${idx + 1}`),
      title: String(q.title || `DevOps Question ${idx + 1}`),
      description: String(q.description || "Solve this DevOps task."),
      difficulty,
      points: typeof q.points === "number" ? q.points : 10,
      kind,
      starterCode: String(q.starterCode || (kind === "terraform"
        ? 'terraform {\n  required_version = ">= 1.3.0"\n}\n\nresource "null_resource" "example" {}\n'
        : kind === "lint"
          ? "FROM alpine:3.20\nRUN echo \"ready\"\n"
          : "echo \"your command\"")),
      validationMode:
        q.validationMode === "runtime" || q.validationMode === "content" || q.validationMode === "hybrid"
          ? q.validationMode
          : kind === "lint"
            ? "runtime"
            : "hybrid",
      lintType:
        q.lintType === "docker" || q.lintType === "kubernetes" || q.lintType === "github_actions"
          ? q.lintType
          : undefined,
      terraformAction:
        q.terraformAction === "init" || q.terraformAction === "plan" || q.terraformAction === "apply" || q.terraformAction === "destroy"
          ? q.terraformAction
          : undefined,
      expectedSubmissionContains: Array.isArray(q.expectedSubmissionContains)
        ? q.expectedSubmissionContains.filter((x): x is string => typeof x === "string")
        : undefined,
      expectedSubmissionRegex: typeof q.expectedSubmissionRegex === "string" ? q.expectedSubmissionRegex : undefined,
      expectedExitCode: typeof q.expectedExitCode === "number" ? q.expectedExitCode : 0,
      expectedStdoutRegex: typeof q.expectedStdoutRegex === "string" ? q.expectedStdoutRegex : undefined,
      minLintScore: typeof q.minLintScore === "number" ? q.minLintScore : undefined,
      instructions: Array.isArray(q.instructions) ? q.instructions.map(String) : ["Read requirements and provide a valid solution."],
      constraints: Array.isArray(q.constraints) ? q.constraints.map(String) : ["Keep it executable and production-safe."],
      hints: Array.isArray(q.hints) ? q.hints.map(String) : ["Start with a minimal valid solution."],
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY in server environment." });
  }

  const {
    yearsOfExperience = "2-4",
    difficulty = "intermediate",
    topicsRequired = "",
    questionCount = 10,
    jobRole = "DevOps Engineer",
    timeLimit = 60,
    focusArea = "balanced",
    title = "DevOps AI Assessment",
    description = "",
  } = req.body || {};

  const safeCount = Math.max(1, Math.min(40, Number(questionCount) || 10));

  const systemPrompt = `
You are a Principal DevOps Interview Architect.
Generate production-realistic DevOps assessment questions that are scenario-based, clear, measurable, and calibrated to candidate experience.

Hard requirements:
1) Return ONLY valid JSON. No markdown, no prose.
2) Output must strictly match the user-provided schema.
3) Questions must be practical (incident/change/security/reliability/cost/performance), not trivia.
4) Include measurable acceptance criteria in expected fields.
5) Avoid destructive or unsafe instructions.
6) Keep language concise and professional.
7) Balance command / terraform / lint where possible.
8) Difficulty must match years of experience and requested level.
9) Do an internal quality check before final output:
   realism, clarity, solvability, difficulty-fit, uniqueness.
`.trim();

  const userPrompt = `
Generate EXACTLY ${safeCount} DevOps questions.

Candidate profile:
- Role: ${jobRole}
- Experience: ${yearsOfExperience}
- Difficulty: ${difficulty}
- Focus: ${focusArea}
- Topics: ${topicsRequired}
- Time limit: ${timeLimit} minutes total
- Assessment title: ${title}
- Assessment description: ${description}

Output JSON schema:
{
  "questions": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "difficulty": "easy|medium|hard",
      "points": number,
      "kind": "command|terraform|lint",
      "starterCode": "string",
      "validationMode": "runtime|content|hybrid",
      "lintType": "docker|kubernetes|github_actions (optional)",
      "terraformAction": "init|plan|apply|destroy (optional)",
      "expectedSubmissionContains": ["string"] (optional),
      "expectedSubmissionRegex": "string (optional)",
      "expectedExitCode": number (optional),
      "expectedStdoutRegex": "string (optional)",
      "minLintScore": number (optional),
      "instructions": ["string","string","string"],
      "constraints": ["string","string"],
      "hints": ["string","string"]
    }
  ]
}

Quality constraints:
- At least 70% scenario-driven real-world tasks (outages, rollback, pipeline failures, IaC drift, container hardening, k8s incidents, observability, secrets/config issues).
- Target balance:
  - 30-40% command tasks
  - 25-35% terraform tasks
  - 25-35% lint tasks
- Every question should test one primary competency and one secondary competency.
- Avoid duplicate patterns.
- Descriptions should be concrete and concise (3-6 lines).
- Keep tasks executable/testable in a sandbox.

Return ONLY JSON.
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "OpenAI request failed", details: errText });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return res.status(502).json({ error: "Invalid response format from model." });
    }

    const parsed = extractJsonObject(content);
    const questions = sanitizeQuestions(parsed?.questions, safeCount);
    if (questions.length === 0) {
      return res.status(502).json({ error: "Model returned no usable questions." });
    }

    return res.status(200).json({ questions });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to generate DevOps questions",
      details: error?.message || "Unknown error",
    });
  }
}
