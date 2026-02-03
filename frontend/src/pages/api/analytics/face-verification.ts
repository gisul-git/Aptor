import type { NextApiRequest, NextApiResponse } from "next";

interface FaceVerificationLog {
  timestamp: number;
  similarityScore: number;
  threshold: number;
  frameQuality: number;
  referenceQuality: number;
  violationTriggered: boolean;
  candidateId: string;
  assessmentId: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { logs } = req.body as { logs: FaceVerificationLog[] };

    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: "Invalid logs format" });
    }

    // TODO: Store logs in your database
    // Example: await db.faceVerificationLogs.insertMany(logs);

    const violations = logs.filter((l) => l.violationTriggered).length;
    const avgSimilarity =
      logs.length > 0
        ? logs.reduce((sum, l) => sum + l.similarityScore, 0) / logs.length
        : 0;

    console.log("[Face Verification Analytics] Received logs:", {
      count: logs.length,
      violations,
      avgSimilarity: avgSimilarity.toFixed(3),
    });

    res.status(200).json({ success: true, logsProcessed: logs.length });
  } catch (error) {
    console.error("[Face Verification Analytics] Error processing logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
