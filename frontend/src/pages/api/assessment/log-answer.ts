import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const payload = req.body;

  if (!payload?.assessmentId || !payload?.token || !payload?.email || !payload?.name) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const response = await fastApiClient.post("/api/v1/assessment/log-answer", payload);
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in log-answer API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to log answer. Please try again.";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

