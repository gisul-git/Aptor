import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { assessmentId, url } = req.body;

  // Assessment ID is optional - can be empty string, null, or undefined
  // Use "temp" as placeholder if not provided
  const assessmentIdParam = (assessmentId && typeof assessmentId === "string" && assessmentId.trim()) ? assessmentId : "temp";
  
  if (!url || typeof url !== "string") {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      `/api/v1/assessments/${assessmentIdParam}/fetch-website-summary`,
      { url },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in fetch-website-summary API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch website summary";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

