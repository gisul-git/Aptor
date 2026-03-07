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

  try {
    const baseUrl = getDevopsBaseUrl();
    const response = await axios.post(`${baseUrl}/api/v1/devops/tests/`, req.body || {}, { timeout: 120000 });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to create DevOps test";
    return res.status(status).json({ error: detail, details: error?.response?.data || null });
  }
}
