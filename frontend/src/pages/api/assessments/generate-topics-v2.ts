import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import axios from "axios";

interface CombinedSkill {
  skill_name: string;
  source: "role" | "manual" | "csv";
  description?: string | null;
  importance_level?: "Low" | "Medium" | "High" | null;
}

interface GenerateTopicsPayload {
  assessmentId?: string;
  assessmentTitle?: string;
  jobDesignation?: string;
  combinedSkills: CombinedSkill[];
  experienceMin: number;
  experienceMax: number;
  experienceMode: "corporate" | "student";
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

  const payload = req.body as GenerateTopicsPayload;

  if (!payload.combinedSkills || payload.combinedSkills.length === 0) {
    return res.status(400).json({ message: "At least one skill must be provided in combinedSkills" });
  }

  // Validate combined skills structure
  for (const skill of payload.combinedSkills) {
    if (!skill.skill_name || !skill.skill_name.trim()) {
      return res.status(400).json({ message: "Each skill must have a skill_name" });
    }
    if (!skill.source || !["role", "manual", "csv"].includes(skill.source)) {
      return res.status(400).json({ message: "Each skill must have a valid source (role, manual, or csv)" });
    }
  }

  try {
    const token = (session as any)?.backendToken;
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";
    
    if (!token) {
      return res.status(401).json({ message: "No authentication token found" });
    }
    
    console.log("[generate-topics-v2] Calling backend:", {
      url: `${backendUrl}/api/v1/assessments/generate-topics`,
      hasToken: !!token,
      skillsCount: payload.combinedSkills?.length || 0,
      backendUrl,
    });
    
    // Use axios directly for server-side API route (not the client-side fastApiClient)
    const response = await axios.post(
      `${backendUrl}/api/v1/assessments/generate-topics`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 180000, // 3 minutes timeout for topic generation
      }
    );
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in generate-topics-v2 API route:", {
      message: error?.message,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      code: error?.code,
      config: {
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
        timeout: error?.config?.timeout,
      },
      backendUrl: process.env.NEXT_PUBLIC_API_URL,
    });
    
    // Handle timeout errors
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      return res.status(504).json({
        message: "Request timeout. The topic generation is taking longer than expected. Please try again.",
      });
    }
    
    // Handle connection errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ECONNRESET') {
      return res.status(503).json({
        message: "Backend service is unavailable. Please check your API configuration.",
        details: process.env.NODE_ENV === 'development' ? {
          backendUrl: process.env.NEXT_PUBLIC_API_URL,
          error: error?.message,
        } : undefined,
      });
    }
    
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to generate topics";
    
    return res.status(statusCode).json({
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        error: error?.message,
        code: error?.code,
        backendUrl: process.env.NEXT_PUBLIC_API_URL,
        responseData: error?.response?.data,
      } : undefined,
    });
  }
}



