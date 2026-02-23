import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, message: "Assessment ID is required" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
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

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    if (req.method === "GET") {
      // Get a specific custom MCQ assessment
      try {
        const response = await fastApiClient.get(`/api/v1/custom-mcq/${id}`, { headers });
        return res.status(response.status || 200).json(response.data);
      } catch (error: any) {
        if (error?.response?.status === 401 && refreshToken) {
          const newToken = await refreshTokenIfNeeded();
          if (newToken) {
            const retryResponse = await fastApiClient.get(`/api/v1/custom-mcq/${id}`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            return res.status(retryResponse.status || 200).json(retryResponse.data);
          }
        }
        throw error;
      }
    } else if (req.method === "DELETE") {
      // Delete a custom MCQ assessment
      try {
        const response = await fastApiClient.delete(`/api/v1/custom-mcq/${id}`, { headers });
        return res.status(response.status || 200).json(response.data);
      } catch (error: any) {
        if (error?.response?.status === 401 && refreshToken) {
          const newToken = await refreshTokenIfNeeded();
          if (newToken) {
            const retryResponse = await fastApiClient.delete(`/api/v1/custom-mcq/${id}`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            return res.status(retryResponse.status || 200).json(retryResponse.data);
          }
        }
        throw error;
      }
    } else if (req.method === "PUT" || req.method === "PATCH") {
      // Update a custom MCQ assessment
      try {
        const response = await fastApiClient.put(`/api/v1/custom-mcq/${id}`, req.body, { headers });
        return res.status(response.status || 200).json(response.data);
      } catch (error: any) {
        if (error?.response?.status === 401 && refreshToken) {
          const newToken = await refreshTokenIfNeeded();
          if (newToken) {
            const retryResponse = await fastApiClient.put(`/api/v1/custom-mcq/${id}`, req.body, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            return res.status(retryResponse.status || 200).json(retryResponse.data);
          }
        }
        throw error;
      }
    } else {
      res.setHeader("Allow", ["GET", "DELETE", "PUT", "PATCH"]);
      return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }
  } catch (error: any) {
    console.error(`Error in custom-mcq/${id} API route:`, error);
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Operation failed";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
}

