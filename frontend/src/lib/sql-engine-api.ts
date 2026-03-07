/**
 * SQL Engine API Client
 * Functions to interact with SQL Execution Engine API via backend proxy
 * This avoids CORS issues by routing requests through the backend
 */

import apiClient from '@/services/api/client';

export interface SQLSchemaResponse {
  questionId: string | null;
  groupId: string;
  schema: Array<{
    table: string;
    columns: Array<{
      name: string;
      type: string;
    }>;
    data: Array<Record<string, any>>;
  }>;
}

export interface SQLExecuteResponse {
  success: boolean;
  output?: any[];
  outputs?: any[][];
  error?: string;
}

export interface SQLSubmitResponse {
  passed: boolean;
  reason?: string | null;
  actualOutput?: any[] | null;
  actualOutputs?: any[][] | null;
  error?: string;
}

/**
 * Fetch database schema from SQL engine via backend proxy
 */
export async function fetchSQLSchema(
  questionId?: string,
  groupId?: string
): Promise<SQLSchemaResponse> {
  if (!questionId) {
    throw new Error('questionId is required to fetch schema');
  }
  
  const payload: any = {
    questionId,
  };
  if (groupId) {
    payload.groupId = groupId;
  }
  
  try {
    const response = await apiClient.post<SQLSchemaResponse>(
      '/api/v1/dsa/assessment/sql-engine/schema',
      payload
    );
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch schema';
    throw new Error(errorMessage);
  }
}

/**
 * Execute SQL query (for testing) via backend proxy
 */
export async function executeSQL(
  questionId: string,
  code: string,
  groupId?: string
): Promise<SQLExecuteResponse> {
  const payload: any = {
    questionId,
    code,
  };
  if (groupId) {
    payload.groupId = groupId;
  }
  
  try {
    const response = await apiClient.post<SQLExecuteResponse>(
      '/api/v1/dsa/assessment/sql-engine/execute',
      payload
    );
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.detail || error.message || 'Failed to execute SQL';
    throw new Error(errorMessage);
  }
}

/**
 * Submit SQL query (for evaluation) via backend proxy
 */
export async function submitSQL(
  questionId: string,
  code: string,
  expectedOutput: any[],
  groupId?: string
): Promise<SQLSubmitResponse> {
  const payload: any = {
    questionId,
    code,
    expectedOutput,
  };
  if (groupId) {
    payload.groupId = groupId;
  }
  
  try {
    const response = await apiClient.post<SQLSubmitResponse>(
      '/api/v1/dsa/assessment/sql-engine/submit',
      payload
    );
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.detail || error.message || 'Failed to submit SQL';
    throw new Error(errorMessage);
  }
}

