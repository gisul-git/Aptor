import type { NextApiRequest, NextApiResponse } from "next";

interface ResetRequestBody {
  session_id?: string;
  sessionId?: string;
}

const COMMAND_EXECUTION_URL = "http://103.173.99.254:4040/execute";

function resolveBaseFromExecuteUrl(url: string): string {
  const cleaned = String(url || "").replace(/\/+$/, "");
  return cleaned.replace(/\/execute$/i, "");
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = (req.body || {}) as ResetRequestBody;
  const sessionId = String(body.session_id || body.sessionId || "").trim();
  if (!sessionId) {
    return res.status(400).json({ ok: false, message: "session_id is required" });
  }

  const base = resolveBaseFromExecuteUrl(COMMAND_EXECUTION_URL);
  const candidates: Array<{
    url: string;
    method: "POST" | "DELETE";
    body?: Record<string, unknown>;
  }> = [
    {
      url: `${base}/reset`,
      method: "POST",
      body: { session_id: sessionId, sessionId, session: sessionId },
    },
    {
      url: `${base}/api/reset`,
      method: "POST",
      body: { session_id: sessionId, sessionId, session: sessionId },
    },
    {
      url: `${base}/session/reset`,
      method: "POST",
      body: { session_id: sessionId, sessionId, session: sessionId },
    },
    {
      url: `${base}/session/${encodeURIComponent(sessionId)}`,
      method: "DELETE",
    },
    {
      url: COMMAND_EXECUTION_URL,
      method: "POST",
      body: { action: "reset", session_id: sessionId, sessionId, session: sessionId },
    },
  ];

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url, {
        method: candidate.method,
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId,
          "X-Session-Id": sessionId,
        },
        body: candidate.body ? JSON.stringify(candidate.body) : undefined,
      });

      if (response.ok) {
        return res.status(200).json({ ok: true, message: "Session reset successful" });
      }

      const text = await safeText(response);
      errors.push(`${candidate.method} ${candidate.url} -> ${response.status} ${text.slice(0, 200)}`);
    } catch (error: unknown) {
      errors.push(
        `${candidate.method} ${candidate.url} -> ${
          error instanceof Error ? error.message : "request failed"
        }`
      );
    }
  }

  return res.status(502).json({
    ok: false,
    message: `Session reset failed for ${sessionId}`,
    details: errors,
  });
}
