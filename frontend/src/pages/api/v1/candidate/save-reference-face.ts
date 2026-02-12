import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { assessmentId, candidateEmail, referenceImage } = req.body;

    if (!assessmentId || !candidateEmail || !referenceImage) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const response = await axios.post(
      `${API_URL}/api/v1/candidate/save-reference-face`,
      {
        assessmentId,
        candidateEmail,
        referenceImage,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Error saving reference face:", error);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || "Failed to save reference face",
    });
  }
}



