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

  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ 
      success: false,
      message: "URL is required" 
    });
  }

  try {
    const token = (session as any)?.backendToken;
    
    // Use a temporary assessment ID for fetching URL summary
    const response = await fastApiClient.post(
      `/api/v1/assessments/temp/fetch-website-summary`,
      { url },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    // Extract summary from backend response
    // Backend returns: { success: true, data: { websiteSummary: { short_summary: "...", ... } } }
    const backendData = response.data?.data || response.data;
    const websiteSummary = backendData?.websiteSummary || backendData;
    const summary = websiteSummary?.short_summary || backendData?.short_summary || backendData?.summary || "";
    
    if (!summary) {
      console.warn("No summary found in backend response:", response.data);
    }
    
    return res.status(response.status || 200).json({
      success: true,
      data: {
        summary: summary,
        url: url,
        websiteSummary: websiteSummary, // Include full summary object if needed
      }
    });
  } catch (error: any) {
    console.error("Error in fetch-and-summarize-url API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch and summarize website";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

