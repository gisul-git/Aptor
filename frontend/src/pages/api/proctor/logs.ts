import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import axios from "axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ 
      success: false, 
      message: "Method not allowed" 
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // Get authentication token from session
  let token = (session as any)?.backendToken;
  const refreshToken = (session as any)?.refreshToken;
  
  // Helper function to refresh token
  const refreshTokenIfNeeded = async (): Promise<string | null> => {
    if (!refreshToken) {
      return null;
    }
    
    try {
      const refreshResponse = await fetch(`${BACKEND_URL}/api/v1/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        return refreshData?.data?.token || null;
      }
    } catch (refreshError) {
      console.error("Token refresh failed in Proctor API route:", refreshError);
    }
    return null;
  };

  try {
    const { assessmentId, userId } = req.query;

    // Validate required fields
    if (!assessmentId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters: assessmentId, userId",
      });
    }

    // Ensure single string values
    const assessmentIdStr = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
    const userIdStr = Array.isArray(userId) ? userId[0] : userId;

    console.log(`[Proctor API] Fetching logs for assessment=${assessmentIdStr}, user=${userIdStr}`);

    // If no token, try to refresh
    if (!token && refreshToken) {
      token = await refreshTokenIfNeeded();
      if (!token) {
        return res.status(401).json({ success: false, message: "Authentication token not found and refresh failed" });
      }
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication token not found" });
    }

    // Call backend FastAPI with authentication
    const backendResponse = await axios.get(
      `${BACKEND_URL}/api/v1/proctor/logs/${encodeURIComponent(assessmentIdStr)}/${encodeURIComponent(userIdStr)}`,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Bearer ${token}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log(`[Proctor API] Logs fetched successfully: ${backendResponse.data?.data?.totalCount || 0} logs`);
    
    return res.status(200).json(backendResponse.data);
  } catch (error: any) {
    // If we get a 401, try to refresh the token and retry
    if (error?.response?.status === 401 && (session as any)?.refreshToken) {
      const newToken = await refreshTokenIfNeeded();
      if (newToken) {
        // Retry with new token
        try {
          const { assessmentId, userId } = req.query;
          const assessmentIdStr = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
          const userIdStr = Array.isArray(userId) ? userId[0] : userId;
          
          const retryResponse = await axios.get(
            `${BACKEND_URL}/api/v1/proctor/logs/${encodeURIComponent(assessmentIdStr)}/${encodeURIComponent(userIdStr)}`,
            {
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Bearer ${newToken}`,
              },
              timeout: 30000,
            }
          );
          return res.status(200).json(retryResponse.data);
        } catch (retryError: any) {
          // If retry also fails, return the error
          const statusCode = retryError?.response?.status || 500;
          const errorMessage =
            retryError?.response?.data?.detail ||
            retryError?.response?.data?.message ||
            retryError?.message ||
            "Failed to fetch proctoring logs";
          return res.status(statusCode).json({
            success: false,
            message: errorMessage,
          });
        }
      }
    }
    
    console.error("[Proctor API] Error fetching logs:", error.message);
    console.error("[Proctor API] Error details:", error.response?.data);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || error.response?.data?.message || error.message || "Failed to fetch proctoring logs",
    });
  }
}

