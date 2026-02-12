import type { NextApiRequest, NextApiResponse } from "next";

import fastApiClient from "../../../lib/fastapi";

interface SendVerificationCodePayload {
  email: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email } = req.body as SendVerificationCodePayload;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const response = await fastApiClient.post("/api/v1/auth/send-verification-code", {
      email,
    });
    // FastAPI returns { data: {...}, message: "..." } structure
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in send-verification-code API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage = error?.response?.data?.detail || 
                        error?.response?.data?.message || 
                        error?.message || 
                        "Failed to send verification code";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

