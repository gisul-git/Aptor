import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      message: "Method not allowed" 
    });
  }

  try {
    const { assessmentId, token, email, name } = req.body;

    if (!assessmentId || !token || !email || !name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: assessmentId, token, email, name",
      });
    }

    const backendResponse = await axios.post(
      `${BACKEND_URL}/api/v1/assessments/start-session`,
      { assessmentId, token, email, name },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    return res.status(200).json(backendResponse.data);
  } catch (error: any) {
    console.error("[API] Error starting session:", error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || error.message || "Failed to start session",
    });
  }
}

