import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// For Next.js API routes, we need to call the backend directly (through API Gateway)
const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_GATEWAY_URL || 'http://localhost:80';
// Direct service URLs for server-side calls (bypassing API Gateway auth)
const DSA_SERVICE_URL = process.env.DSA_SERVICE_URL || 'http://localhost:3004';
const AIML_SERVICE_URL = process.env.AIML_SERVICE_URL || 'http://localhost:3003';

const backendClient = axios.create({
  baseURL: API_GATEWAY_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Direct service clients (bypass API Gateway for server-side calls)
const dsaServiceClient = axios.create({
  baseURL: DSA_SERVICE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

const aimlServiceClient = axios.create({
  baseURL: AIML_SERVICE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("[get-reference-photo] 🚀 Next.js API route called:", {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'none',
      'content-type': req.headers['content-type'],
    },
    timestamp: new Date().toISOString(),
  });

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { assessmentId, candidateEmail, testType } = req.query;

    if (!assessmentId || !candidateEmail) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters: assessmentId, candidateEmail",
      });
    }

    const assessmentIdStr = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
    const candidateEmailStr = Array.isArray(candidateEmail) ? candidateEmail[0] : candidateEmail;
    const testTypeStr = Array.isArray(testType) ? testType[0] : testType;

    console.log("[get-reference-photo] 🔍 Fetching reference photo:", {
      assessmentId: assessmentIdStr,
      candidateEmail: candidateEmailStr,
      testType: testTypeStr || "auto-detect",
    });

    // Use API Gateway for all requests (works in both local and Azure environments)
    // If testType is provided, call the specific endpoint through API Gateway
    if (testTypeStr) {
      const normalizedTestType = testTypeStr.toLowerCase().trim();
      
      if (normalizedTestType === "dsa") {
        // Call DSA service through API Gateway
        try {
          const dsaUrl = `/api/v1/dsa/tests/get-reference-photo`;
          console.log("[get-reference-photo] 🎯 Calling DSA service via API Gateway (testType=dsa):", {
            url: dsaUrl,
            fullUrl: `${API_GATEWAY_URL}${dsaUrl}`,
            apiGatewayUrl: API_GATEWAY_URL,
          });
          
          const dsaResponse = await backendClient.get(dsaUrl, {
            params: {
              assessmentId: assessmentIdStr,
              candidateEmail: candidateEmailStr,
            },
          });

          console.log("[get-reference-photo] ✅ DSA response received:", {
            success: dsaResponse.data?.success,
            hasReferenceImage: !!dsaResponse.data?.data?.referenceImage,
          });

          if (dsaResponse.data) {
            return res.status(200).json(dsaResponse.data);
          }
        } catch (dsaError: any) {
          const dsaStatus = dsaError?.response?.status;
          console.error("[get-reference-photo] ❌ DSA endpoint failed:", {
            status: dsaStatus,
            message: dsaError?.response?.data?.detail || dsaError?.message,
          });

          // Return error response
          if (dsaError.response?.status === 404) {
            return res.status(200).json({
              success: true,
              message: "No reference photo found",
              data: { referenceImage: null },
            });
          }

          return res.status(dsaError.response?.status || 500).json({
            success: false,
            message: dsaError.response?.data?.detail || dsaError.message || "Failed to fetch reference photo from DSA service",
          });
        }
      } else if (normalizedTestType === "aiml") {
        // Call AIML service through API Gateway
        try {
          const aimlUrl = `/api/v1/aiml/tests/get-reference-photo`;
          console.log("[get-reference-photo] 🎯 Calling AIML service via API Gateway (testType=aiml):", {
            url: aimlUrl,
            fullUrl: `${API_GATEWAY_URL}${aimlUrl}`,
            apiGatewayUrl: API_GATEWAY_URL,
          });
          
          const aimlResponse = await backendClient.get(aimlUrl, {
            params: {
              assessmentId: assessmentIdStr,
              candidateEmail: candidateEmailStr,
            },
          });

          console.log("[get-reference-photo] ✅ AIML response received:", {
            success: aimlResponse.data?.success,
            hasReferenceImage: !!aimlResponse.data?.data?.referenceImage,
          });

          if (aimlResponse.data) {
            return res.status(200).json(aimlResponse.data);
          }
        } catch (aimlError: any) {
          const aimlStatus = aimlError?.response?.status;
          console.error("[get-reference-photo] ❌ AIML endpoint failed:", {
            status: aimlStatus,
            message: aimlError?.response?.data?.detail || aimlError?.message,
          });

          // Return error response
          if (aimlError.response?.status === 404) {
            return res.status(200).json({
              success: true,
              message: "No reference photo found",
              data: { referenceImage: null },
            });
          }

          return res.status(aimlError.response?.status || 500).json({
            success: false,
            message: aimlError.response?.data?.detail || aimlError.message || "Failed to fetch reference photo from AIML service",
          });
        }
      } else {
        // Unknown testType, fall back to generic endpoint
        console.log("[get-reference-photo] ⚠️ Unknown testType, using generic endpoint:", normalizedTestType);
      }
    }

    // Fallback: If testType not provided or unknown, try endpoints in order (backward compatibility)
    // First, try AIML service through API Gateway
    try {
      const aimlUrl = `/api/v1/aiml/tests/get-reference-photo`;
      console.log("[get-reference-photo] 🔍 Trying AIML service via API Gateway (fallback):", {
        url: aimlUrl,
        fullUrl: `${API_GATEWAY_URL}${aimlUrl}`,
      });
      
      const aimlResponse = await backendClient.get(aimlUrl, {
        params: {
          assessmentId: assessmentIdStr,
          candidateEmail: candidateEmailStr,
        },
      });

      console.log("[get-reference-photo] ✅ AIML response received:", {
        success: aimlResponse.data?.success,
        hasReferenceImage: !!aimlResponse.data?.data?.referenceImage,
      });

      if (aimlResponse.data) {
        return res.status(200).json(aimlResponse.data);
      }
    } catch (aimlError: any) {
      const aimlStatus = aimlError?.response?.status;
      console.log("[get-reference-photo] ⚠️ AIML endpoint failed (fallback):", {
        status: aimlStatus,
        message: aimlError?.response?.data?.detail || aimlError?.message,
      });
    }

    // Second, try DSA service through API Gateway
    try {
      const dsaUrl = `/api/v1/dsa/tests/get-reference-photo`;
      console.log("[get-reference-photo] 🔍 Trying DSA service via API Gateway (fallback):", {
        url: dsaUrl,
        fullUrl: `${API_GATEWAY_URL}${dsaUrl}`,
      });
      
      const dsaResponse = await backendClient.get(dsaUrl, {
        params: {
          assessmentId: assessmentIdStr,
          candidateEmail: candidateEmailStr,
        },
      });

      console.log("[get-reference-photo] ✅ DSA response received:", {
        success: dsaResponse.data?.success,
        hasReferenceImage: !!dsaResponse.data?.data?.referenceImage,
      });

      if (dsaResponse.data) {
        return res.status(200).json(dsaResponse.data);
      }
    } catch (dsaError: any) {
      const dsaStatus = dsaError?.response?.status;
      console.log("[get-reference-photo] ⚠️ DSA endpoint failed (fallback):", {
        status: dsaStatus,
        message: dsaError?.response?.data?.detail || dsaError?.message,
      });
    }

    // Fallback to generic endpoint (for AI Assessment, Custom MCQ tests)
    console.log("[get-reference-photo] 🔍 Trying generic endpoint as fallback");
    try {
      const backendResponse = await backendClient.get(
        `/api/v1/candidate/get-reference-photo`,
        {
          params: {
            assessmentId: assessmentIdStr,
            candidateEmail: candidateEmailStr,
          },
        }
      );

      console.log("[get-reference-photo] ✅ Generic endpoint response received:", {
        success: backendResponse.data?.success,
        hasReferenceImage: !!backendResponse.data?.data?.referenceImage,
      });

      return res.status(200).json(backendResponse.data);
    } catch (genericError: any) {
      console.error("[get-reference-photo] ❌ Generic endpoint also failed:", {
        status: genericError?.response?.status,
        message: genericError?.response?.data?.detail || genericError?.message,
      });

      // If 404, return success with null image (not an error)
      if (genericError.response?.status === 404) {
        return res.status(200).json({
          success: true,
          message: "No reference photo found",
          data: { referenceImage: null },
        });
      }

      return res.status(genericError.response?.status || 500).json({
        success: false,
        message: genericError.response?.data?.detail || genericError.message || "Failed to fetch reference photo",
      });
    }
  } catch (error: any) {
    console.error("[get-reference-photo] ❌ Unexpected error:", error.message);
    
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reference photo",
    });
  }
}


