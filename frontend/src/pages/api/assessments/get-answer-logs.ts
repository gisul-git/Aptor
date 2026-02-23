import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { assessmentId, candidateEmail, candidateName } = req.query;

  if (!assessmentId || typeof assessmentId !== "string" || !candidateEmail || !candidateName) {
    return res.status(400).json({ message: "Assessment ID, candidate email, and candidate name are required" });
  }

  try {
    const token = (session as any)?.backendToken;
    if (!token) {
      return res.status(401).json({ message: "Authentication token not found" });
    }

    const url = `/api/v1/assessments/${assessmentId}/answer-logs?candidateEmail=${encodeURIComponent(candidateEmail as string)}&candidateName=${encodeURIComponent(candidateName as string)}`;
    
    const response = await fastApiClient.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in get-answer-logs API route:", error);
    console.error("Error response:", error?.response?.data);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to get answer logs";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      detail: error?.response?.data?.detail || error?.response?.data,
    });
  }
}

