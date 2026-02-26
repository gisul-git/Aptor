import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

/**
 * API Route: /api/proctor/agora/get-token
 * Proxies to backend /api/v1/proctor/agora/get-token
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_GATEWAY_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { assessmentId, candidateId, adminId, role } = req.body;

    // Validate required fields
    if (!assessmentId) {
      return res.status(400).json({
        status: "error",
        message: "assessmentId is required",
      });
    }

    if (role === "candidate" && !candidateId) {
      return res.status(400).json({
        status: "error",
        message: "candidateId is required for candidate role",
      });
    }

    if (role === "admin" && !adminId) {
      return res.status(400).json({
        status: "error",
        message: "adminId is required for admin role",
      });
    }

    // Forward to backend FastAPI
    try {
      const backendResponse = await axios.post(
        `${API_URL}/api/v1/proctor/agora/get-token`,
        {
          assessmentId,
          candidateId,
          adminId,
          role: role || "candidate",
        },
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      return res.status(200).json(backendResponse.data);
    } catch (backendError: any) {
      console.error("[Agora Token API] Backend error:", backendError.message);
      console.error("[Agora Token API] Backend error details:", backendError.response?.data);
      
      return res.status(backendError.response?.status || 500).json({
        status: "error",
        message: backendError.response?.data?.detail || backendError.message || "Failed to get Agora token",
      });
    }
  } catch (error) {
    console.error("[Agora Token API] Error processing request:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}
