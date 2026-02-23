import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]";
import fastApiClient from "../../../../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id: assessmentId, email: candidateEmail } = req.query;
  const { candidate_name: candidateName } = req.query;

  if (!assessmentId || typeof assessmentId !== "string") {
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  if (!candidateEmail || typeof candidateEmail !== "string") {
    return res.status(400).json({ message: "Candidate email is required" });
  }

  if (!candidateName || typeof candidateName !== "string") {
    return res.status(400).json({ message: "Candidate name is required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.get(
      `/api/v1/assessments/${assessmentId}/candidate/${encodeURIComponent(candidateEmail)}/detailed-results`,
      {
        params: {
          candidate_name: candidateName,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in detailed-results API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to get detailed results";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

