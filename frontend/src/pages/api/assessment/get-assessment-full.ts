import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// For Next.js API routes, we need to call the backend directly (through API Gateway)
// Use the API Gateway URL from environment or default to localhost:80
const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_GATEWAY_URL || 'http://localhost:80';

const backendClient = axios.create({
  baseURL: API_GATEWAY_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("[get-assessment-full] 🚀 API route called:", {
    method: req.method,
    url: req.url,
    query: req.query,
    timestamp: new Date().toISOString(),
  });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { assessmentId, token } = req.query;

  console.log("[get-assessment-full] 📋 Request params:", { assessmentId, token, hasToken: !!token });

  if (!assessmentId || typeof assessmentId !== "string") {
    console.error("[get-assessment-full] ❌ Missing or invalid assessmentId");
    return res.status(400).json({ message: "Assessment ID is required" });
  }

  if (!token || typeof token !== "string") {
    console.error("[get-assessment-full] ❌ Missing or invalid token");
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    // First, try AIML-specific full test endpoint.
    // This allows AIML tests (stored in the AIML service) to be resolved without
    // depending on the generic AI assessment service.
    try {
      const aimlUrl = `/api/v1/aiml/tests/${assessmentId}/full`;
      const fullAimlUrl = `${API_GATEWAY_URL}${aimlUrl}`;
      console.log(`[get-assessment-full] 🔵 Attempting AIML endpoint:`, {
        testId: assessmentId,
        url: aimlUrl,
        fullUrl: fullAimlUrl,
        apiGatewayUrl: API_GATEWAY_URL,
        timestamp: new Date().toISOString(),
      });
      
      const aimlResponse = await backendClient.get(aimlUrl);
      
      console.log("[get-assessment-full] ✅ AIML endpoint succeeded:", {
        status: aimlResponse.status,
        statusText: aimlResponse.statusText,
        hasData: !!aimlResponse.data,
        dataType: typeof aimlResponse.data,
        dataKeys: aimlResponse.data ? Object.keys(aimlResponse.data) : [],
        dataPreview: aimlResponse.data ? JSON.stringify(aimlResponse.data).substring(0, 200) : 'no data',
      });
      
      // AIML endpoint returns { success: true, message: "...", data: {...} }
      // Return it as-is for the frontend (same structure as generic endpoint)
      console.log("[get-assessment-full] ✅ Returning AIML response to frontend");
      return res.status(aimlResponse.status || 200).json(aimlResponse.data);
    } catch (aimlError: any) {
      const aimlStatus = aimlError?.response?.status;
      const aimlStatusText = aimlError?.response?.statusText;
      const aimlDetail = aimlError?.response?.data?.detail || aimlError?.response?.data?.message;
      const aimlMessage = aimlError?.message;
      const aimlCode = aimlError?.code;
      const aimlUrl = aimlError?.config?.url || `${API_GATEWAY_URL}/api/v1/aiml/tests/${assessmentId}/full`;
      const aimlResponseData = aimlError?.response?.data;

      // Log detailed error information
      console.error("[get-assessment-full] ❌ AIML endpoint failed:", {
        status: aimlStatus,
        statusText: aimlStatusText,
        code: aimlCode,
        detail: aimlDetail,
        message: aimlMessage,
        url: aimlUrl,
        fullUrl: aimlError?.config?.baseURL + aimlError?.config?.url,
        responseData: aimlResponseData,
        errorType: aimlError?.name,
        stack: aimlError?.stack?.substring(0, 500),
      });
      
      // If AIML explicitly reports "Test not found" (404) or bad ID (400), fall through to generic handler.
      // For other AIML errors (500, 503, network errors), still try generic endpoint as fallback
      if (aimlStatus === 404 || aimlStatus === 400) {
        console.log("[get-assessment-full] ⚠️ AIML test not found (404/400), trying generic endpoint");
      } else {
        console.log(`[get-assessment-full] ⚠️ AIML endpoint error (${aimlStatus || 'no status'}), falling back to generic endpoint`);
      }
    }

    // Fallback: use generic candidate get-assessment-full (AI assessments, Custom MCQ, DSA)
    console.log("[get-assessment-full] 🔵 Attempting generic endpoint as fallback:", {
      assessmentId,
      hasToken: !!token,
      url: "/api/v1/candidate/get-assessment-full",
      fullUrl: `${API_GATEWAY_URL}/api/v1/candidate/get-assessment-full`,
    });
    
    const response = await backendClient.get("/api/v1/candidate/get-assessment-full", {
      params: {
        assessmentId,
        token,
      },
    });

    console.log("[get-assessment-full] ✅ Generic endpoint succeeded:", {
      status: response.status,
      hasData: !!response.data,
    });

    // The backend returns { success: true, data: {...} } (assessment directly in data)
    // Return it as-is for the frontend
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in get-assessment-full API route:", error);
    console.error("Error details:", {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error?.message,
      url: error?.config?.url,
      params: error?.config?.params,
    });
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch assessment";
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      detail: error?.response?.data?.detail || errorMessage,
    });
  }
}

