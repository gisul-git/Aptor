import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { topic, category } = req.body;

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return res.status(400).json({ message: "Topic is required" });
  }

  if (!category || !["aptitude", "communication", "logical_reasoning"].includes(category)) {
    return res.status(400).json({ message: "Valid category is required (aptitude, communication, or logical_reasoning)" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      `/api/v1/assessments/topics/validate-category?topic=${encodeURIComponent(topic.trim())}&category=${category}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error validating topic category:", error);
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: error.response.data?.detail || "Failed to validate topic category",
        data: {
          valid: false,
          error: "Unable to validate topic. Please try again.",
        },
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to validate topic category",
      data: {
        valid: false,
        error: "Unable to validate topic. Please try again.",
      },
    });
  }
}

