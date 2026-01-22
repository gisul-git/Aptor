import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import fastApiClient from "../../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.query;
  const updateData = req.body;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.patch(
      `/api/v1/assessments/${id}/website-summary`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in website-summary API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to update website summary";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}



