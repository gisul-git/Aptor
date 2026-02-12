import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface SendInvitationsPayload {
  assessmentId: string;
  candidates: Array<{ email: string; name: string }>;
  examUrl: string;
  template?: {
    logoUrl?: string;
    companyName?: string;
    message?: string;
    footer?: string;
    sentBy?: string;
  };
  forceResend?: boolean;
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

  const payload = req.body as SendInvitationsPayload;

  if (!payload.assessmentId || !payload.candidates || !payload.examUrl) {
    return res.status(400).json({ 
      message: "Missing required fields: assessmentId, candidates, and examUrl are required" 
    });
  }

  try {
    const token = (session as any)?.backendToken;
    if (!token) {
      return res.status(401).json({ message: "Authentication token not found" });
    }

    const response = await fastApiClient.post("/api/v1/assessments/send-invitations", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in send-invitations API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to send invitations";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}







