import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { assessmentId, token, questionIndex, sourceCode, languageId, publicTestcases, hiddenTestcases } = req.body;

  if (!assessmentId || !token || questionIndex === undefined || !sourceCode || !languageId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Call backend API to submit code (no auth required for candidate endpoints)
    const response = await fastApiClient.post("/api/v1/assessment/submit-code", {
      assessmentId,
      token,
      questionIndex,
      sourceCode,
      languageId: parseInt(languageId),
      publicTestcases: publicTestcases || [],
      hiddenTestcases: hiddenTestcases || [],
    });

    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in submit-code API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to submit code";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

