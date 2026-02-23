import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const payload = req.body;

  if (!payload.assessmentId || !payload.token || !payload.email || !payload.name) {
    return res.status(400).json({ 
      message: "Missing required fields: assessmentId, token, email, and name are required" 
    });
  }

  try {
    const response = await fastApiClient.post("/api/v1/candidate/save-candidate-info", payload);
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in save-candidate-info API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to save candidate information";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}







