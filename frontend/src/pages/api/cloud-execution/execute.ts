import type { NextApiRequest, NextApiResponse } from "next";

const ENGINE_BASE_URL = process.env.CLOUD_EXECUTION_ENGINE_URL || "http://localhost:8000";
const EXECUTION_API_KEY = process.env.EXECUTION_API_KEY || "";

type ExecuteRequest = {
  session_id: string;
  command: string;
  localstack_host: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const payload = req.body as ExecuteRequest;
  if (!payload?.session_id || !payload?.command || !payload?.localstack_host) {
    return res.status(400).json({ error: "session_id, command, and localstack_host are required" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${ENGINE_BASE_URL}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(EXECUTION_API_KEY ? { "x-api-key": EXECUTION_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach execution engine";
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}

