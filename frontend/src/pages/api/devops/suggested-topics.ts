import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const DEFAULT_DEVOPS_URL = "http://localhost:8010";

function getDevopsBaseUrls(): string[] {
  const configured = process.env.DEVOPS_SERVICE_URL || process.env.DEVOPS_API_URL;
  const urls = [configured, DEFAULT_DEVOPS_URL, "http://localhost:8000"].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return Array.from(new Set(urls));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const yearsOfExperience = Number(req.query.yearsOfExperience ?? 0);
  const difficulty = String(req.query.difficulty ?? "intermediate");

  const targets = getDevopsBaseUrls();
  const errors: string[] = [];

  for (const baseUrl of targets) {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/devops/questions/suggested-topics`, {
        params: { years_of_experience: yearsOfExperience, difficulty },
        timeout: 30000,
      });
      return res.status(response.status).json(response.data);
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
    error: "Failed to fetch suggested topics",
    details: errors,
  });
}
