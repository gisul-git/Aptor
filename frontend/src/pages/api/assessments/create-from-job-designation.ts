import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface CreateFromJobDesignationPayload {
  jobDesignation: string;
  selectedSkills: string[];
  experienceMin: string;
  experienceMax: string;
  experienceMode?: "corporate" | "student";
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

  const payload = req.body as CreateFromJobDesignationPayload;

  if (!payload.jobDesignation || !payload.jobDesignation.trim()) {
    return res.status(400).json({ message: "Job designation is required" });
  }

  if (!payload.selectedSkills || payload.selectedSkills.length === 0) {
    return res.status(400).json({ message: "At least one skill must be selected" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/create-assessment-from-job-designation",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in create-from-job-designation API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to create assessment";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

