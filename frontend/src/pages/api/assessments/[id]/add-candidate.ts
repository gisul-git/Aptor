import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import fastApiClient from "../../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id: assessmentId } = req.query;
  if (!assessmentId || typeof assessmentId !== "string") {
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ message: "Email and name are required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.post(
      `/api/v1/assessments/${assessmentId}/add-candidate`,
      { email, name },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in add-candidate API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to add candidate";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}





