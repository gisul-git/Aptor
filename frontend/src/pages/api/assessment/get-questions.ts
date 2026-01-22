import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { assessmentId, token } = req.query;
  const assessmentIdString = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
  const tokenString = Array.isArray(token) ? token[0] : token;

  if (!assessmentIdString || !tokenString) {
    return res.status(400).json({ message: "Missing assessment ID or token" });
  }

  try {
    const response = await fastApiClient.get(
      `/api/v1/assessment/get-questions?assessmentId=${assessmentIdString}&token=${tokenString}`
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in get-questions API route:", error);
    console.error("Error details:", {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
      assessmentId: assessmentIdString,
      token: tokenString ? `${tokenString.substring(0, 10)}...` : "missing",
    });
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to get questions";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      detail: error?.response?.data?.detail || errorMessage,
    });
  }
}

