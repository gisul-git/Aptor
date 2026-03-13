import type { NextApiRequest, NextApiResponse } from "next";

interface SubmitRequestBody {
  session_id?: string;
  sessionId?: string;
}

const COMMAND_EXECUTION_WS_URL =
  process.env.DEVOPS_EXECUTION_WS_URL || "ws://103.173.99.254:4040/terminal";

function resolveBase(url: string): string {
  const normalized = String(url || "")
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://")
    .replace(/\/+$/, "");
  return normalized.replace(/\/terminal$/i, "");
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { detail: text };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = (req.body || {}) as SubmitRequestBody;
  const sessionId = String(body.session_id || body.sessionId || "").trim();
  if (!sessionId) {
    return res.status(400).json({ ok: false, message: "session_id is required" });
  }

  const base = resolveBase(COMMAND_EXECUTION_WS_URL);
  try {
    const response = await fetch(`${base}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: (data?.detail as string) || "Submit failed",
        data,
      });
    }
    return res.status(200).json({
      ok: true,
      history: Array.isArray(data?.history) ? data.history : [],
    });
  } catch (error: unknown) {
    return res.status(502).json({
      ok: false,
      message: error instanceof Error ? error.message : "Submit request failed",
    });
  }
}
