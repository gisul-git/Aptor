import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const DEFAULT_DEVOPS_URL = "http://localhost:8010";

function getDevopsBaseUrl(): string {
  return process.env.DEVOPS_SERVICE_URL || process.env.DEVOPS_API_URL || DEFAULT_DEVOPS_URL;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const testId = String(req.body?.testId || "").trim();
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();

  if (!testId) {
    return res.status(400).json({ error: "testId is required" });
  }
  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  try {
    const baseUrl = getDevopsBaseUrl();
    const response = await axios.post(
      `${baseUrl}/api/v1/devops/tests/${encodeURIComponent(testId)}/add-candidate`,
      { name, email },
      { timeout: 120000 }
    );
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to add candidate";
    return res.status(status).json({ error: detail, details: error?.response?.data || null });
  }
}
