import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface TopicConfig {
  topic: string;
  questionType: string;
  difficulty: string;
  numQuestions: number;
  // Optional fields supported by the v2 backend endpoint
  isAptitude?: boolean;
  subTopic?: string;
  language?: string;
  judge0_enabled?: boolean;
}

interface GenerateQuestionsFromConfigPayload {
  assessmentId: string;
  skill: string;
  topics: TopicConfig[];
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

  const payload = req.body as GenerateQuestionsFromConfigPayload;

  if (!payload.assessmentId || !payload.skill || !payload.topics || payload.topics.length === 0) {
    return res.status(400).json({ message: "Assessment ID, skill, and topics are required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      // v1 endpoint was removed; use v2 which supports SQL/AIML (preserving requestedType) and v2 flows.
      "/api/v2/assessments/generate-questions-from-config",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in generate-questions-from-config API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to generate questions";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

