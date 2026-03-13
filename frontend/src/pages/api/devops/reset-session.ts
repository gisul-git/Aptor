import type { NextApiRequest, NextApiResponse } from "next";

interface ResetRequestBody {
  session_id?: string;
  sessionId?: string;
}

const COMMAND_EXECUTION_WS_URL =
  process.env.DEVOPS_EXECUTION_WS_URL || "ws://103.173.99.254:4040/terminal";

function resolveBaseFromExecuteUrl(url: string): string {
  const cleaned = String(url || "").replace(/\/+$/, "");
  return cleaned.replace(/\/execute$/i, "").replace(/\/terminal$/i, "");
}

function wsToHttpBase(wsUrl: string): string {
  const normalized = String(wsUrl || "").replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
  return resolveBaseFromExecuteUrl(normalized);
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const text = await response.text();
    if (!text.trim()) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function resetOverWebSocket(wsUrl: string, sessionId: string, timeoutMs = 15000): Promise<boolean> {
  return await new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // Ignore close errors.
      }
      resolve(false);
    }, timeoutMs);

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        // Ignore close errors.
      }
      resolve(ok);
    };

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify({
            action: "reset",
            session_id: sessionId,
            sessionId,
            session: sessionId,
          })
        );
      } catch {
        finish(false);
      }
    };

    ws.onmessage = (event) => {
      let payload: Record<string, unknown> | string | null = null;
      if (typeof event.data === "string") {
        try {
          payload = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          payload = { output: event.data } as Record<string, unknown>;
        }
      } else {
        payload = String(event.data ?? "");
      }
      const isObjectPayload = typeof payload === "object" && payload !== null;
      const ok =
        (isObjectPayload && payload.ok === true) ||
        (isObjectPayload && payload.success === true) ||
        (isObjectPayload && String(payload.status || "").toLowerCase() === "success");
      finish(ok);
    };

    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
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

  const wsResetOk = await resetOverWebSocket(COMMAND_EXECUTION_WS_URL, sessionId);
  if (wsResetOk) {
    return res.status(200).json({ ok: true, message: "Session reset successful" });
  }

  const base = wsToHttpBase(COMMAND_EXECUTION_WS_URL);
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
      url: `${base}/terminal`,
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
        const data = await safeJson(response);
        const nextSessionId = String(data?.session_id || data?.sessionId || "").trim();
        return res.status(200).json({
          ok: true,
          message: "Session reset successful",
          session_id: nextSessionId || undefined,
        });
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
