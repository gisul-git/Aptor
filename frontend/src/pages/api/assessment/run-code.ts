import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Support both old format (for backward compatibility) and new format
  const { 
    assessmentId, 
    assessment_id, 
    questionId, 
    question_id, 
    sourceCode, 
    source_code,
    languageId, 
    language_id,
    token, 
    questionIndex, 
    testcases 
  } = req.body;

  // Normalize field names - support both camelCase and snake_case
  const normalizedAssessmentId = assessmentId || assessment_id;
  const normalizedQuestionId = questionId || question_id;
  const normalizedSourceCode = sourceCode || source_code;
  const normalizedLanguageId = languageId || language_id;

  if (!normalizedAssessmentId || !normalizedQuestionId || !normalizedSourceCode || normalizedLanguageId === undefined) {
    return res.status(400).json({ 
      success: false,
      message: "Missing required fields: assessmentId, questionId, sourceCode, languageId" 
    });
  }

  try {
    // Call backend API to run code
    // Backend endpoint: /api/v1/assessment/run (from code_execution.py)
    console.log('[API Route] Calling backend /api/v1/assessment/run with:', {
      question_id: normalizedQuestionId,
      assessment_id: normalizedAssessmentId,
      language_id: normalizedLanguageId,
      source_code_length: normalizedSourceCode.length
    });
    
    const response = await fastApiClient.post("/api/v1/assessment/run", {
      question_id: normalizedQuestionId,
      source_code: normalizedSourceCode,
      language_id: parseInt(String(normalizedLanguageId)),
      assessment_id: normalizedAssessmentId,
    });

    console.log('[API Route] Backend response status:', response.status);
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in run-code API route:", error);
    console.error("Error details:", {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      code: error?.code,
      config: {
        url: error?.config?.url,
        method: error?.config?.method,
        data: error?.config?.data ? JSON.parse(error?.config?.data) : null
      }
    });
    
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to run code";
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      detail: error?.response?.data?.detail || errorMessage,
    });
  }
}

