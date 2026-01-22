/**
 * API Route: Create Proctoring Session
 * 
 * Proxies to backend /api/v1/proctor/create-session
 */

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { assessmentId, candidateEmail } = req.body;

    if (!assessmentId || !candidateEmail) {
      return res.status(400).json({
        status: "error",
        message: "assessmentId and candidateEmail are required",
      });
    }

    const response = await axios.post(
      `${API_URL}/api/v1/proctor/create-session`,
      {
        assessmentId,
        candidateEmail,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Return in format expected by frontend: { status: 'ok', sessionId }
    const sessionId = response.data?.sessionId || response.data?.data?.sessionId || response.data?.id;
    if (!sessionId) {
      return res.status(500).json({
        status: "error",
        message: "Session created but no sessionId returned",
      });
    }

    return res.status(200).json({ status: "ok", sessionId });
  } catch (error: any) {
    console.error("[API] Error creating proctoring session:", error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        status: "error",
        message: error.response.data?.detail || error.response.data?.error || "Failed to create session",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}




