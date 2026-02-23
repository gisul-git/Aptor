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

  const { assessmentId } = req.query;
  const { newTitle, keepSchedule = false, keepCandidates = false } = req.body || {};

  if (!assessmentId || typeof assessmentId !== "string") {
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  if (!newTitle || typeof newTitle !== "string" || newTitle.trim().length < 3) {
    return res.status(400).json({ message: "New assessment name is required and must be at least 3 characters" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      `/api/v1/custom-mcq/${assessmentId}/clone`,
      {
        newTitle: newTitle.trim(),
        keepSchedule: keepSchedule,
        keepCandidates: keepCandidates,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in clone custom MCQ API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to clone custom MCQ assessment";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

