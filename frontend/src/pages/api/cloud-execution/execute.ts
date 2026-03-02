import type { NextApiRequest, NextApiResponse } from "next";

const ENGINE_BASE_URL = process.env.CLOUD_EXECUTION_ENGINE_URL || "http://localhost:8000";
const EXECUTION_API_KEY = process.env.EXECUTION_API_KEY || "";

type ExecuteRequest = {
  session_id: string;
  command?: string;
  localstack_host?: string;
  mode?: "aws" | "terraform";
  terraform_code?: string;
  terraform_action?: "init" | "plan" | "apply" | "destroy" | "validate";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const payload = req.body as ExecuteRequest;
  const mode = payload?.mode || "aws";

  if (!payload?.session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  if (mode === "terraform") {
    if (!payload?.terraform_code) {
      return res.status(400).json({ error: "terraform_code is required for terraform mode" });
    }
  } else if (!payload?.command) {
    return res.status(400).json({ error: "command is required for aws mode" });
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

