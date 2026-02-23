import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    let token = (session as any)?.backendToken;
    const refreshToken = (session as any)?.refreshToken;
    
    // Helper function to refresh token
    const refreshTokenIfNeeded = async (): Promise<string | null> => {
      if (!refreshToken) {
        return null;
      }
      
      try {
        const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";
        const refreshResponse = await fetch(`${baseURL}/api/v1/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          return refreshData?.data?.token || null;
        }
      } catch (refreshError) {
        console.error("Token refresh failed in API route:", refreshError);
      }
      return null;
    };
    
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
    
    // Try the request with the token
    try {
      const response = await fastApiClient.get("/api/v1/assessments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.status(response.status || 200).json(response.data);
    } catch (error: any) {
      // If we get a 401, try to refresh the token and retry
      if (error?.response?.status === 401 && refreshToken) {
        const newToken = await refreshTokenIfNeeded();
        if (newToken) {
          // Retry with new token
          try {
            const retryResponse = await fastApiClient.get("/api/v1/assessments", {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            });
            return res.status(retryResponse.status || 200).json(retryResponse.data);
          } catch (retryError: any) {
            // If retry also fails, return the error
            const statusCode = retryError?.response?.status || 500;
            const errorMessage =
              retryError?.response?.data?.detail ||
              retryError?.response?.data?.message ||
              retryError?.message ||
              "Failed to fetch assessments";
            return res.status(statusCode).json({
              success: false,
              message: errorMessage,
            });
          }
        }
      }
      
      // Re-throw if not a 401 or refresh failed
      throw error;
    }
  } catch (error: any) {
    console.error("Error in list assessments API route:", error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch assessments";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

