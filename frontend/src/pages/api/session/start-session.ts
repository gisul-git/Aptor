/**
 * API Route: Start Proctoring Session
 * 
 * Proxies to backend /api/v1/proctor/start-session
 */

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { assessmentId, userId, ai_proctoring, live_proctoring, consent, metadata } = req.body;

    if (!assessmentId || !userId) {
      return res.status(400).json({
        success: false,
        error: "assessmentId and userId are required",
      });
    }

    if (!consent) {
      return res.status(400).json({
        success: false,
        error: "User consent is required",
      });
    }

    const response = await axios.post(
      `${API_URL}/api/v1/proctor/start-session`,
      {
        assessmentId,
        userId,
        ai_proctoring: ai_proctoring || false,
        live_proctoring: live_proctoring || false,
        consent,
        metadata,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error("[API] Error starting proctoring session:", error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.detail || error.response.data?.error || "Failed to start session",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}




