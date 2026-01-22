import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { assessmentId, token } = req.query;

  if (!assessmentId || !token) {
    return res.status(400).json({ message: "Missing assessment ID or token" });
  }

  try {
    // Use the correct backend route: /api/v1/candidate/get-assessment-schedule
    const response = await fastApiClient.get(
      `/api/v1/candidate/get-assessment-schedule?assessmentId=${assessmentId}&token=${token}`
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in get-schedule API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to get schedule";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

