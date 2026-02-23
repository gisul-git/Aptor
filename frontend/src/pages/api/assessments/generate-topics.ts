import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface GenerateTopicsPayload {
  assessmentType: string[];
  jobRole?: string;
  experience?: string;
  skills?: string[];
  numTopics?: number;
  aptitudeConfig?: {
    quantitative?: {
      enabled: boolean;
      difficulty: string;
      numQuestions: number;
    } | null;
    logicalReasoning?: {
      enabled: boolean;
      difficulty: string;
      numQuestions: number;
    } | null;
    verbalAbility?: {
      enabled: boolean;
      difficulty: string;
      numQuestions: number;
    } | null;
    numericalReasoning?: {
      enabled: boolean;
      difficulty: string;
      numQuestions: number;
    } | null;
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

  const payload = req.body as GenerateTopicsPayload;

  // Validate assessment type
  if (!payload.assessmentType || !Array.isArray(payload.assessmentType) || payload.assessmentType.length === 0) {
    return res.status(400).json({ message: "At least one assessment type must be selected" });
  }

  // Validate technical fields if technical is selected
  if (payload.assessmentType.includes("technical")) {
    if (!payload.jobRole || !payload.experience || !payload.skills || payload.skills.length === 0) {
      return res.status(400).json({ message: "Job role, experience, and at least one skill are required for technical assessments" });
    }
    if (!payload.numTopics || payload.numTopics < 1) {
      return res.status(400).json({ message: "Number of topics is required and must be at least 1 for technical assessments" });
    }
  }

  // Validate aptitude fields if aptitude is selected
  if (payload.assessmentType.includes("aptitude")) {
    if (!payload.aptitudeConfig) {
      return res.status(400).json({ message: "Aptitude configuration is required for aptitude assessments" });
    }
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/generate-topics",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in generate-topics API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to generate topics";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

