import type { NextApiRequest, NextApiResponse } from "next";
import fastApiClient from "../../../lib/fastapi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { 
    assessmentId, 
    assessment_id, 
    questionId, 
    question_id, 
    sqlQuery, 
    sql_query
  } = req.body;

  // Normalize field names
  const normalizedAssessmentId = assessmentId || assessment_id;
  const normalizedQuestionId = questionId || question_id;
  const normalizedSqlQuery = sqlQuery || sql_query;

  if (!normalizedAssessmentId || !normalizedQuestionId || !normalizedSqlQuery) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: assessmentId, questionId, sqlQuery"
    });
  }

  try {
    // Call backend API to submit SQL
    // Backend endpoint: /api/v1/dsa/assessment/submit-sql
    console.log('[API Route] Calling backend /api/v1/dsa/assessment/submit-sql with:', {
      question_id: normalizedQuestionId,
      sql_query_length: normalizedSqlQuery.length
    });
    
    const response = await fastApiClient.post("/api/v1/dsa/assessment/submit-sql", {
      question_id: normalizedQuestionId,
      sql_query: normalizedSqlQuery,
    }, {
      params: {
        user_id: "assessment-candidate" // For assessment context
      }
    });

    console.log('[API Route] Backend response status:', response.status);
    return res.status(response.status || 200).json(response.data);
  } catch (error: any) {
    console.error("Error in submit-sql API route:", error);
    console.error("Error details:", {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      code: error?.code,
    });
    
    const statusCode = error?.response?.status || 500;
    const errorMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to submit SQL query";
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      detail: error?.response?.data?.detail || errorMessage,
    });
  }
}

