import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { assessmentId, candidateEmail } = req.query;

    if (!assessmentId || !candidateEmail) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters: assessmentId, candidateEmail",
      });
    }

    const assessmentIdStr = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
    const candidateEmailStr = Array.isArray(candidateEmail) ? candidateEmail[0] : candidateEmail;

    const backendResponse = await axios.get(
      `${BACKEND_URL}/api/v1/candidate/get-reference-photo`,
      {
        params: {
          assessmentId: assessmentIdStr,
          candidateEmail: candidateEmailStr,
        },
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    return res.status(200).json(backendResponse.data);
  } catch (error: any) {
    console.error("[Reference Photo API] Error:", error.message);
    
    // If 404, return success with null image (not an error)
    if (error.response?.status === 404) {
      return res.status(200).json({
        success: true,
        message: "No reference photo found",
        data: { referenceImage: null },
      });
    }

    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || error.message || "Failed to fetch reference photo",
    });
  }
}


