import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../../lib/fastapi";

/**
 * Public API route for candidates to get assessment details for taking
 * This route does NOT require authentication - candidates use token from URL
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { id } = req.query;
  const { token } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, message: "Assessment ID is required" });
  }

  if (!token || typeof token !== "string") {
    return res.status(400).json({ success: false, message: "Token is required" });
  }

  try {
    // Build query parameters
    const params: any = { token };
    if (req.query.email) params.email = req.query.email;
    if (req.query.name) params.name = req.query.name;

    // Call backend API - this endpoint is public (token validated server-side)
    const response = await fastApiClient.get(`/api/v1/custom-mcq/take/${id}`, {
      params,
    });

    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error(`Error in custom-mcq/take/${id} API route:`, error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to get assessment";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

