import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface PreviousTopic {
  topicId: string;
  previousTopicLabel: string;
  source: "role" | "manual" | "csv";
  relatedSkill?: string;
}

interface CombinedSkill {
  skill_name: string;
  source: "role" | "manual" | "csv";
  description?: string;
  importance_level?: "Low" | "Medium" | "High";
}

interface ImproveAllTopicsPayload {
  assessmentId: string;
  experienceMode: "corporate" | "student";
  experienceMin: number;
  experienceMax: number;
  previousTopics: PreviousTopic[];
  combinedSkills?: CombinedSkill[];
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

  const payload = req.body as ImproveAllTopicsPayload;

  if (!payload.assessmentId || !payload.previousTopics || payload.previousTopics.length === 0) {
    return res.status(400).json({ message: "Assessment ID and Previous Topics are required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/improve-all-topics",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in improve-all-topics API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to improve topics";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

