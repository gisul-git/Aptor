import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = (session as any)?.backendToken;
    const response = await fastApiClient.delete("/api/v1/assessments/remove-topic", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: req.body,
    });
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in remove-topic API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to remove topic";
    return res.status(statusCode).json({
      message: errorMessage,
    });
  }
}

