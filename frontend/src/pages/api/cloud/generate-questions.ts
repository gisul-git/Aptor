import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const DEFAULT_CLOUD_URL = "http://localhost:8010";

function getDevopsBaseUrls(): string[] {
  const configured = process.env.CLOUD_SERVICE_URL || process.env.CLOUD_API_URL;
  const urls = [configured, DEFAULT_CLOUD_URL, "http://localhost:8000"].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return Array.from(new Set(urls));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const targets = getDevopsBaseUrls();
  const errors: string[] = [];

  for (const baseUrl of targets) {
    try {
      const response = await axios.post(`${baseUrl}/api/v1/cloud/questions/generate-ai`, req.body || {}, { timeout: 120000 });
      const questions = response?.data?.questions || response?.data?.data?.questions || [];
      if (Array.isArray(questions) && questions.length > 0) {
        return res.status(200).json({ questions });
      }
      errors.push(`${baseUrl}: backend returned no questions`);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.message ||
        "Unknown backend error";
      errors.push(`${baseUrl}: ${detail}`);
    }
  }

  return res.status(500).json({
    error: "Failed to generate Cloud questions",
    details: errors,
  });
}

