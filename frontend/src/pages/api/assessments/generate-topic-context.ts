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

  const { topicName, category } = req.body;

  if (!topicName || topicName.trim().length === 0) {
    return res.status(400).json({ message: "Topic name is required" });
  }

  if (!category || !["aptitude", "communication", "logical_reasoning"].includes(category)) {
    return res.status(400).json({ message: "Invalid category. Must be aptitude, communication, or logical_reasoning" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      `/api/v1/assessments/generate-topic-context?topic_name=${encodeURIComponent(topicName)}&category=${category}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in generate-topic-context API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to generate topic context";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}








