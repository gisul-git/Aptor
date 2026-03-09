import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

const DEFAULT_CLOUD_URL = "http://localhost:8010";

function getDevopsBaseUrl(): string {
  return process.env.CLOUD_SERVICE_URL || process.env.CLOUD_API_URL || DEFAULT_CLOUD_URL;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = String((session?.user as any)?.id || "").trim();
    const baseUrl = getDevopsBaseUrl();
    const response = await axios.post(`${baseUrl}/api/v1/cloud/tests/`, req.body || {}, {
      timeout: 120000,
      headers: userId
        ? {
            "x-user-id": userId,
            "x-actor-id": userId,
          }
        : undefined,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to create Cloud test";
    return res.status(status).json({ error: detail, details: error?.response?.data || null });
  }
}

