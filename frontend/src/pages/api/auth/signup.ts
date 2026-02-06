import type { NextApiRequest, NextApiResponse } from "next";

import fastApiClient from "../../../lib/fastapi";

interface SignupPayload {
  name: string;
  email: string;
  password: string;
  organization?: string;
  phone?: string;
  country?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, email, password, organization, phone, country } = req.body as SignupPayload;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  try {
    const payload: any = {
      name,
      email,
      password,
    };
    
    // Add optional fields if providedd
    if (organization) {
      payload.organization = organization;
    }
    if (phone) {
      payload.phone = phone;
    }
    if (country) {
      payload.country = country;
    }
    
    console.log("🟡 [Signup API] Sending request to FastAPI with payload:", {
      name,
      email,
      password: password ? `${password.substring(0, 2)}***` : "empty",
      organization,
      phone,
      country,
    });
    
    const response = await fastApiClient.post("/api/v1/auth/org-signup-email", payload);
    console.log("🟢 [Signup API] Success response:", {
      status: response.status,
      data: response.data,
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error("🔴 [Signup API] Error caught:", {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorKeys: error ? Object.keys(error) : [],
    });
    
    console.error("🔴 [Signup API] Error response:", {
      hasResponse: !!error?.response,
      responseStatus: error?.response?.status,
      responseStatusText: error?.response?.statusText,
      responseData: error?.response?.data,
      responseDataType: typeof error?.response?.data,
      responseDataKeys: error?.response?.data ? Object.keys(error?.response?.data) : [],
    });
    
    console.error("🔴 [Signup API] Error detail field:", {
      detail: error?.response?.data?.detail,
      detailType: typeof error?.response?.data?.detail,
      detailIsArray: Array.isArray(error?.response?.data?.detail),
      detailLength: Array.isArray(error?.response?.data?.detail) ? error?.response?.data?.detail.length : null,
    });
    
    if (Array.isArray(error?.response?.data?.detail)) {
      error?.response?.data?.detail.forEach((item: any, idx: number) => {
        console.error(`🔴 [Signup API] Detail item ${idx}:`, {
          item,
          itemType: typeof item,
          itemKeys: item ? Object.keys(item) : [],
          itemCtx: item?.ctx,
          itemCtxType: typeof item?.ctx,
          itemCtxKeys: item?.ctx ? Object.keys(item?.ctx) : [],
          itemCtxError: item?.ctx?.error,
          itemCtxErrorType: typeof item?.ctx?.error,
          itemCtxErrorConstructor: item?.ctx?.error?.constructor?.name,
        });
      });
    }
    
    const statusCode = error?.response?.status || 500;
    
    // Extract readable error message from validation errors
    let errorMessage: string;
    
    // Check if error.message is already corrupted (contains [object Object])
    if (error?.message && error.message === '[object Object]') {
      // If message is corrupted, extract from response data directly
      if (error?.response?.data?.detail && Array.isArray(error.response.data.detail)) {
        const firstError = error.response.data.detail[0];
        errorMessage = firstError?.msg || firstError?.message || "Validation error";
      } else if (error?.response?.data?.message) {
        errorMessage = typeof error.response.data.message === 'string' 
          ? error.response.data.message 
          : "Validation error";
      } else {
        errorMessage = "Signup failed";
      }
    } else if (error?.response?.data?.detail && Array.isArray(error.response.data.detail)) {
      // Extract the first error message from the validation errors array
      const firstError = error.response.data.detail[0];
      errorMessage = firstError?.msg || firstError?.message || "Validation error";
    } else if (error?.response?.data?.message) {
      // Ensure message is a strings
      errorMessage = typeof error.response.data.message === 'string' 
        ? error.response.data.message 
        : JSON.stringify(error.response.data.message);
    } else if (error?.response?.data?.detail) {
      // If detail is not an array, convert it to string safely
      if (typeof error.response.data.detail === 'string') {
        errorMessage = error.response.data.detail;
      } else {
        errorMessage = JSON.stringify(error.response.data.detail);
      }
    } else if (error?.message) {
      // Use error message, but check if it's corrupted
      errorMessage = error.message === '[object Object]' ? "Signup failed" : error.message;
    } else {
      errorMessage = "Signup failed";
    }
    
    // Final safety check - ensure errorMessage is always a string
    if (typeof errorMessage !== 'string') {
      errorMessage = String(errorMessage);
    }
    
    // If still corrupted, use fallback
    if (errorMessage === '[object Object]' || errorMessage.includes('[object Object]')) {
      errorMessage = "Signup failed. Please check your input and try again.";
    }
    
    console.error("🔴 [Signup API] Final error message to return:", {
      statusCode,
      errorMessage,
      errorMessageType: typeof errorMessage,
      errorMessageIsArray: Array.isArray(errorMessage),
      errorMessageStringified: JSON.stringify(errorMessage),
    });
    
    return res.status(statusCode).json({ message: errorMessage });
  }
}


