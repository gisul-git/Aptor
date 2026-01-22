import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { assessmentId, token } = req.query;

  if (!assessmentId || typeof assessmentId !== "string") {
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const response = await fastApiClient.get("/api/v1/candidate/get-assessment-full", {
      params: {
        assessmentId,
        token,
      },
    });
    
    // The backend returns { success: true, data: {...} } (assessment directly in data)
    // Return it as-is for the frontend
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in get-assessment-full API route:", error);
    console.error("Error details:", {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      url: error?.config?.url,
      params: error?.config?.params,
    });
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch assessment";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      detail: error?.response?.data?.detail || errorMessage,
    });
  }
}

