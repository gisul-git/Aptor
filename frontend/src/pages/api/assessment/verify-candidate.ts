import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

interface VerifyCandidatePayload {
  assessmentId: string;
  token: string;
  email: string;
  name: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const payload = req.body as VerifyCandidatePayload;

  if (!payload.assessmentId || !payload.token || !payload.email || !payload.name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  console.log("[API Route] ========== VERIFY-CANDIDATE CALLED ==========");
  console.log("[API Route] Request payload:", payload);

  try {
    const response = await fastApiClient.post(
      "/api/v1/candidate/verify-candidate",
      payload
    );
    
    console.log("[API Route] ✅ Backend response success");
    console.log("[API Route] Response status:", response.status);
    console.log("[API Route] Response data:", JSON.stringify(response.data, null, 2));
    
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("[API Route] ========== BACKEND ERROR ==========");
    console.error("[API Route] Error response status:", error?.response?.status);
    console.error("[API Route] Error response data:", error?.response?.data);
    console.error("[API Route] Error message:", error?.message);
    console.error("[API Route] Full error:", error);
    
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to verify candidate";
    
    console.log("[API Route] Returning error to frontend:", {
      statusCode,
      errorMessage,
    });
    
    // Return error in both 'detail' and 'message' fields to match backend format
    return res.status(statusCode).json({
      detail: errorMessage,
      message: errorMessage,
      errorMessage: errorMessage,
      data: {
        message: errorMessage,
      },
    });
  }
}

