import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface UpdateAssessmentDraftPayload {
  assessmentId?: string;
  title?: string;
  description?: string;
  jobDesignation?: string;
  selectedSkills?: string[];
  experienceMin?: number;
  experienceMax?: number;
  experienceMode?: "corporate" | "student";
  topics?: any[];
  topics_v2?: any[];
  previewQuestions?: any[];
  questions?: any[];
  questionTypeTimes?: { [key: string]: number };
  enablePerSectionTimers?: boolean;
  sectionTimers?: {
    MCQ?: number;
    Subjective?: number;
    PseudoCode?: number;
    Coding?: number;
    SQL?: number;
    AIML?: number;
  };
  // Note: sectionTimers might be stored in questionTypeTimes or a separate field
  scoringRules?: {
    MCQ?: number;
    Subjective?: number;
    PseudoCode?: number;
    Coding?: number;
    SQL?: number;
    AIML?: number;
  };
  passPercentage?: number;
  schedule?: any;
  candidates?: Array<{ email: string; name: string }>;
  assessmentUrl?: string;
  proctoringSettings?: any; // Unified proctoring settings schema
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = req.body as UpdateAssessmentDraftPayload;
  
  // Log what we're sending to backend
  console.log("=".repeat(80));
  console.log("[FRONTEND_API] update-draft route - Received request body:");
  console.log("[FRONTEND_API] scoringRules:", payload.scoringRules);
  console.log("[FRONTEND_API] passPercentage:", payload.passPercentage);
  console.log("[FRONTEND_API] enablePerSectionTimers:", payload.enablePerSectionTimers);
  console.log("[FRONTEND_API] sectionTimers:", payload.sectionTimers);
  console.log("=".repeat(80));

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.put(
      "/api/v1/assessments/update-draft",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    console.log("[FRONTEND_API] Backend response:", response.data);
    
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in update-draft API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to update draft";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

