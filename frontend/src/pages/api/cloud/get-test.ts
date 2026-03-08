import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const DEFAULT_CLOUD_URL = "http://localhost:8010";

function getDevopsBaseUrl(): string {
  return process.env.CLOUD_SERVICE_URL || process.env.CLOUD_API_URL || DEFAULT_CLOUD_URL;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const idRaw = req.query.id;
  const testId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  if (!testId) {
    return res.status(400).json({ error: "Missing test id" });
  }

  try {
    const baseUrl = getDevopsBaseUrl();
    const response = await axios.get(`${baseUrl}/api/v1/cloud/tests/${encodeURIComponent(testId)}`, {
      timeout: 120000,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to fetch test";
    return res.status(status).json({ error: detail, details: error?.response?.data || null });
  }
}

