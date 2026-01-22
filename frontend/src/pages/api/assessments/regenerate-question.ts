import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface RegenerateQuestionPayload {
  assessmentId: string;
  topicId: string;
  rowId: string;
  questionIndex: number;
  oldQuestion: string;
  questionType: string;
  difficulty: string;
  experienceMode?: string;
  experienceMin?: number;
  experienceMax?: number;
  additionalRequirements?: string;
  feedback?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = req.body as RegenerateQuestionPayload;

  // Validate required fields
  if (!payload.assessmentId || !payload.topicId || !payload.rowId || payload.questionIndex === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (!payload.oldQuestion || !payload.questionType || !payload.difficulty) {
    return res.status(400).json({ message: "Missing question data" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/regenerate-question",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in regenerate-question API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to regenerate question";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

