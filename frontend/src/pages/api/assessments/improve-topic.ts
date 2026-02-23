import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface ImproveTopicPayload {
  assessmentId: string;
  topicId: string;
  previousTopicLabel: string;
  experienceMode: "corporate" | "student";
  experienceMin: number;
  experienceMax: number;
  source: "role" | "manual" | "csv";
  skillMetadataProvided?: {
    skill_name?: string;
    description?: string;
    importance_level?: string;
  };
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

  const payload = req.body as ImproveTopicPayload;

  if (!payload.assessmentId || !payload.topicId || !payload.previousTopicLabel) {
    return res.status(400).json({ message: "Assessment ID, Topic ID, and Previous Topic Label are required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/improve-topic",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in improve-topic API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to improve topic";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

