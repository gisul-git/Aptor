import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface RegenerateTopicPayload {
  assessmentId: string;
  topicId: string;
  assessmentTitle?: string;
  jobDesignation: string;
  selectedSkills: string[];
  experienceMin: number;
  experienceMax: number;
  experienceMode: "corporate" | "student";
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

  const payload = req.body as RegenerateTopicPayload;

  if (!payload.assessmentId || !payload.topicId) {
    return res.status(400).json({ message: "Assessment ID and Topic ID are required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/regenerate-topic",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in regenerate-topic-v2 API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to regenerate topic";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}








