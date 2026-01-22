import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Stub endpoint for logging analytics events.
 * For AI assessments, this is a no-op to prevent frontend errors.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Stub endpoint - analytics logging is optional
    // Return success to prevent frontend errors
    return res.status(200).json({
      success: true,
      message: "Event logged (stub endpoint)",
      data: { logged: true }
    });
  } catch (error: any) {
    console.error("[log-event] Error:", error);
    return res.status(500).json({
      error: "Failed to log event",
      message: error.message
    });
  }
}

