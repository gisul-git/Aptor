import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ 
      success: false, 
      message: "Method not allowed" 
    });
  }

  try {
    const { assessmentId, userId } = req.query;

    // Validate required fields
    if (!assessmentId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters: assessmentId, userId",
      });
    }

    // Ensure single string values
    const assessmentIdStr = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
    const userIdStr = Array.isArray(userId) ? userId[0] : userId;

    console.log(`[Proctor API] Fetching summary for assessment=${assessmentIdStr}, user=${userIdStr}`);

    // Call backend FastAPI
    const backendResponse = await axios.get(
      `${BACKEND_URL}/api/v1/proctor/summary/${encodeURIComponent(assessmentIdStr)}/${encodeURIComponent(userIdStr)}`,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log("[Proctor API] Summary fetched successfully");
    
    return res.status(200).json(backendResponse.data);
  } catch (error: any) {
    console.error("[Proctor API] Error fetching summary:", error.message);
    console.error("[Proctor API] Error details:", error.response?.data);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || error.message || "Failed to fetch proctoring summary",
    });
  }
}

