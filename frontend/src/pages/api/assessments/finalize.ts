import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = req.body;
  
  // Log what we're forwarding to backend
  console.log("=".repeat(80));
  console.log("[FRONTEND_API] finalize route - Received request body:");
  console.log("[FRONTEND_API] assessmentId:", payload.assessmentId);
  console.log("[FRONTEND_API] scoringRules:", payload.scoringRules);
  console.log("[FRONTEND_API] passPercentage:", payload.passPercentage);
  console.log("[FRONTEND_API] Full payload keys:", Object.keys(payload));
  console.log("=".repeat(80));

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post("/api/v1/assessments/finalize-assessment", req.body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    console.log("[FRONTEND_API] Finalize response status:", response.status);
    console.log("[FRONTEND_API] Finalize response success:", response.data?.success);
    
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in finalize-assessment API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to finalize assessment";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

