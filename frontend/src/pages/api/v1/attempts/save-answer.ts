import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Stub endpoint for saving answers during assessment.
 * For AI assessments, answers are saved in the final submission.
 * This endpoint exists to prevent 500 errors during assessment navigation.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // For AI assessments, this is a no-op since answers are saved on final submission
    // Return success to prevent frontend errors
    return res.status(200).json({
      success: true,
      message: "Answer saved (stub endpoint for AI assessments)",
      data: { saved: true }
    });
  } catch (error: any) {
    console.error("[save-answer] Error:", error);
    return res.status(500).json({
      error: "Failed to save answer",
      message: error.message
    });
  }
}

