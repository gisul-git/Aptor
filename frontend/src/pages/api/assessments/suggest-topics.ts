import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

interface SuggestTopicsPayload {
  category: "aptitude" | "communication" | "logical_reasoning" | "technical" | "auto";
  query: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { category, query } = req.body as SuggestTopicsPayload;

  if (!category || !["aptitude", "communication", "logical_reasoning", "technical", "auto"].includes(category)) {
    return res.status(400).json({ message: "Invalid category. Must be aptitude, communication, logical_reasoning, technical, or auto" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      "/api/v1/assessments/topics/suggest",
      { category, query: query || "" },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in suggest-topics API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to get topic suggestions";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}








