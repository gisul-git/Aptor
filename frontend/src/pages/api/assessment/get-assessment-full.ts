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
<<<<<<< HEAD
    // First, try AIML-specific /full endpoint.
=======
  
    try {
      const dsaUrl = `/api/v1/dsa/tests/${assessmentId}/full`;
      const fullDsaUrl = `${API_GATEWAY_URL}${dsaUrl}`;
      console.log(`[get-assessment-full] 🔵 Attempting DSA endpoint:`, {
        testId: assessmentId,
        url: dsaUrl,
        fullUrl: fullDsaUrl,
        apiGatewayUrl: API_GATEWAY_URL,
        token: token ? `${token.substring(0, 10)}...` : 'missing',
        timestamp: new Date().toISOString(),
      });
      
      const dsaResponse = await backendClient.get(dsaUrl, {
        params: {
          token,
        },
      });
      
      console.log("[get-assessment-full] ✅ DSA endpoint succeeded:", {
        status: dsaResponse.status,
        statusText: dsaResponse.statusText,
        hasData: !!dsaResponse.data,
        dataType: typeof dsaResponse.data,
        dataKeys: dsaResponse.data ? Object.keys(dsaResponse.data) : [],
        dataPreview: dsaResponse.data ? JSON.stringify(dsaResponse.data).substring(0, 200) : 'no data',
      });
      
      // DSA endpoint returns { success: true, message: "...", data: {...} }
      // Return it as-is for the frontend (same structure as generic endpoint)
      console.log("[get-assessment-full] ✅ Returning DSA response to frontend");
      return res.status(dsaResponse.status || 200).json(dsaResponse.data);
    } catch (dsaError: any) {
      const dsaStatus = dsaError?.response?.status;
      const dsaStatusText = dsaError?.response?.statusText;
      const dsaDetail = dsaError?.response?.data?.detail || dsaError?.response?.data?.message;
      const dsaMessage = dsaError?.message;
      const dsaCode = dsaError?.code;
      const dsaUrl = dsaError?.config?.url || `${API_GATEWAY_URL}/api/v1/dsa/tests/${assessmentId}/full`;
      const dsaResponseData = dsaError?.response?.data;

      // Log detailed error information
      console.error("[get-assessment-full] ❌ DSA endpoint failed:", {
        status: dsaStatus,
        statusText: dsaStatusText,
        code: dsaCode,
        detail: dsaDetail,
        message: dsaMessage,
        url: dsaUrl,
        fullUrl: dsaError?.config?.baseURL + dsaError?.config?.url,
        responseData: dsaResponseData,
        errorType: dsaError?.name,
        stack: dsaError?.stack?.substring(0, 500),
      });
      
      // If DSA explicitly reports "Test not found" (404) or bad ID (400), try AIML next.
      // For other DSA errors (500, 503, network errors), still try other endpoints as fallback
      if (dsaStatus === 404 || dsaStatus === 400) {
        console.log("[get-assessment-full] ⚠️ DSA test not found (404/400), trying AIML endpoint");
      } else {
        console.log(`[get-assessment-full] ⚠️ DSA endpoint error (${dsaStatus || 'no status'}), trying AIML endpoint`);
      }
    }

    // Second, try AIML-specific full test endpoint.
>>>>>>> dev
    // This allows AIML tests (stored in the AIML service) to be resolved without
    // depending on the generic AI assessment service.
    try {
      const aimlUrl = `/api/v1/aiml/tests/${assessmentId}/full`;
      const fullAimlUrl = `${API_GATEWAY_URL}${aimlUrl}`;
      console.log(`[get-assessment-full] 🔵 Attempting AIML /full endpoint:`, {
        testId: assessmentId,
        url: aimlUrl,
        fullUrl: fullAimlUrl,
        apiGatewayUrl: API_GATEWAY_URL,
        timestamp: new Date().toISOString(),
      });
      
      // The /full endpoint doesn't require token (public endpoint)
      const aimlResponse = await backendClient.get(aimlUrl);
      
      console.log("[get-assessment-full] ✅ AIML endpoint succeeded:", {
        status: aimlResponse.status,
        statusText: aimlResponse.statusText,
        hasData: !!aimlResponse.data,
        dataType: typeof aimlResponse.data,
        dataKeys: aimlResponse.data ? Object.keys(aimlResponse.data) : [],
        fullResponse: JSON.stringify(aimlResponse.data, null, 2),
      });
      
      // AIML endpoint returns { success: true, message: "...", data: {...} }
      // Extract the actual test data from response.data.data
      const aimlData = aimlResponse.data;
      console.log("[get-assessment-full] 🔍 Raw aimlData structure:", {
        hasSuccess: !!aimlData?.success,
        hasData: !!aimlData?.data,
        aimlDataKeys: aimlData ? Object.keys(aimlData) : [],
        aimlDataFull: JSON.stringify(aimlData, null, 2),
      });
      
      const testData = aimlData?.data || aimlData; // Extract nested data, or use entire response if no nested data
      
      console.log("[get-assessment-full] 🔍 Extracted testData:", {
        testDataType: typeof testData,
        testDataKeys: testData ? Object.keys(testData) : [],
        hasSchedule: !!(testData?.schedule),
        scheduleKeys: testData?.schedule ? Object.keys(testData.schedule) : [],
        hasProctoringSettingsTop: !!(testData?.proctoringSettings),
        proctoringSettingsTop: testData?.proctoringSettings,
        hasProctoringSettingsSchedule: !!(testData?.schedule?.proctoringSettings),
        proctoringSettingsSchedule: testData?.schedule?.proctoringSettings,
        testDataFull: JSON.stringify(testData, null, 2),
      });
      
      // Return in the same format as generic endpoint: { success: true, data: {...} }
      // where data contains the actual assessment/test object with proctoringSettings
      const responsePayload = {
        success: aimlData?.success ?? true,
        message: aimlData?.message ?? "Assessment fetched successfully",
        data: testData, // Return the actual test_dict with proctoringSettings
      };
      
      console.log("[get-assessment-full] 📤 Returning response payload:", {
        hasSuccess: !!responsePayload.success,
        hasData: !!responsePayload.data,
        dataKeys: responsePayload.data ? Object.keys(responsePayload.data) : [],
        hasProctoringSettingsInData: !!(responsePayload.data?.proctoringSettings || responsePayload.data?.schedule?.proctoringSettings),
        proctoringSettingsInData: responsePayload.data?.proctoringSettings || responsePayload.data?.schedule?.proctoringSettings,
        responsePayloadFull: JSON.stringify(responsePayload, null, 2),
      });
      
      return res.status(aimlResponse.status || 200).json(responsePayload);
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

    // Fallback: use generic candidate get-assessment-full (AI assessments, Custom MCQ)
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

