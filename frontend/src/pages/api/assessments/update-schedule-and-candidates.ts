import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface UpdateScheduleAndCandidatesPayload {
  assessmentId: string;
  examMode?: "strict" | "flexible";
  duration?: number;
  startTime?: string;
  endTime?: string;
  accessTimeBeforeStart?: number;
  enablePerSectionTimers?: boolean;
  sectionTimers?: Record<string, number>;
  candidates: Array<{ email: string; name: string }>;
  assessmentUrl: string;
  token: string;
  accessMode?: "private" | "public";
  invitationTemplate?: any;
  // Legacy fields (kept for backward compatibility)
  timerMode?: "section" | "scheduleOnly";
  sectionTotalTime?: number;
  scheduledWindowTime?: number;
  examDuration?: number;
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

  const payload = req.body as UpdateScheduleAndCandidatesPayload;

  // Validate required fields
  if (!payload.assessmentId) {
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  // Validate examMode if provided
  if (payload.examMode && !["strict", "flexible"].includes(payload.examMode)) {
    return res.status(400).json({ message: "Invalid examMode. Must be 'strict' or 'flexible'" });
  }

  // Validate duration if provided
  if (payload.duration !== undefined && (isNaN(payload.duration) || payload.duration <= 0)) {
    return res.status(400).json({ message: "Duration must be a positive number" });
  }

  // For flexible mode, endTime is required if startTime is provided
  if (payload.examMode === "flexible" && payload.startTime && !payload.endTime) {
    return res.status(400).json({ message: "End time is required for flexible exam mode" });
  }

  // Candidates array is required (can be empty for public mode)
  if (!Array.isArray(payload.candidates)) {
    return res.status(400).json({ message: "Candidates must be an array" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/update-schedule-and-candidates",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in update-schedule-and-candidates API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to update schedule and candidates";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

