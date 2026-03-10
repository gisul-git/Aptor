import type { NextApiRequest, NextApiResponse } from "next";

type QuestionLike = Record<string, any>;

function normalizeDifficulty(value: unknown): "easy" | "medium" | "hard" {
  const lowered = String(value ?? "").trim().toLowerCase();
  if (lowered === "beginner") return "easy";
  if (lowered === "intermediate") return "medium";
  if (lowered === "advanced") return "hard";
  if (lowered === "easy" || lowered === "medium" || lowered === "hard") return lowered;
  return "medium";
}

function normalizePayload(q: QuestionLike, idx: number) {
  return {
    title: String(q.title || `Cloud Question ${idx + 1}`),
    description: String(q.description || "Cloud task"),
    difficulty: normalizeDifficulty(q.difficulty),
    kind: String(q.kind || "command"),
    points: Number(q.points || 10),
    instructions: Array.isArray(q.instructions) ? q.instructions : [],
    constraints: Array.isArray(q.constraints) ? q.constraints : [],
    hints: Array.isArray(q.hints) ? q.hints : [],
    starter_code: typeof q.starterCode === "string" ? { bash: q.starterCode } : {},
    ai_generated: true,
    is_published: false,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const questions = Array.isArray(req.body?.questions) ? (req.body.questions as QuestionLike[]) : [];
  if (questions.length === 0) {
    return res.status(400).json({ error: "questions array is required" });
  }

  const cloudBase =
    process.env.CLOUD_SERVICE_URL ||
    process.env.CLOUD_EXECUTION_API_URL ||
    "http://127.0.0.1:8010";

  try {
    const results = await Promise.all(
      questions.map(async (q, idx) => {
        const response = await fetch(`${cloudBase.replace(/\/+$/, "")}/api/v1/cloud/questions/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalizePayload(q, idx)),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            ok: false,
            error: data?.detail || data?.error || `Failed to save question ${idx + 1}`,
            question: { ...q, id: String(q.id || `generated-cloud-${idx + 1}`), persisted: false },
          };
        }
        const saved = data?.data || data;
        return {
          ok: true,
          question: {
            ...q,
            id: String(saved?.id || q.id || `generated-cloud-${idx + 1}`),
            persisted: true,
            is_published: false,
          },
        };
      })
    );

    const savedQuestions = results.map((r) => r.question);
    const failed = results.filter((r) => !r.ok);
    return res.status(200).json({
      savedQuestions,
      failedCount: failed.length,
      errors: failed.map((f) => f.error),
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to save questions",
      detail: error?.message || "Unknown error",
    });
  }
}

