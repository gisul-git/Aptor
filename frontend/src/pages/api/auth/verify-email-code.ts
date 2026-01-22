import type { NextApiRequest, NextApiResponse } from "next";

import fastApiClient from "../../../lib/fastapi";

interface VerifyEmailCodePayload {
  email: string;
  code: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email, code } = req.body as VerifyEmailCodePayload;

  if (!email || !code) {
    return res.status(400).json({ message: "Email and code are required" });
  }

  try {
    const response = await fastApiClient.post("/api/v1/auth/verify-email-code", {
      email,
      code,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const statusCode = error?.response?.status || 500;
    const errorMessage = error?.response?.data?.detail || 
                        error?.response?.data?.message || 
                        error?.message || 
                        "Failed to verify code";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

