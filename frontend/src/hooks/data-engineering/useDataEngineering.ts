/**
 * React hooks for Data Engineering Service
 */

import { useState, useEffect, useCallback } from 'react';
import { dataEngineeringAPI, UserProgress } from '../../services/data-engineering/api';
import type { Question, ExecutionResult } from '../../libs/data-engineering/integration';

// Hook for managing questions
export const useQuestions = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async (params?: {
    difficulty?: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataEngineeringAPI.getQuestions(params);
      setQuestions(result.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateQuestion = useCallback(async (difficulty: string, topic: string) => {
    setLoading(true);
    setError(null);
    try {
      const question = await dataEngineeringAPI.generateQuestion(difficulty, topic);
      setQuestions(prev => [question, ...prev]);
      return question;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate question');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    questions,
    loading,
    error,
    fetchQuestions,
    generateQuestion,
  };
};

// Hook for managing code execution
export const useCodeExecution = () => {
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeCode = useCallback(async (code: string, mode: 'test' | 'submit' = 'test') => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataEngineeringAPI.executeCode(code, mode);
      setExecutionResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute code');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitSolution = useCallback(async (questionId: string, code: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataEngineeringAPI.submitSolution(questionId, code);
      setExecutionResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit solution');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkExecutionStatus = useCallback(async (jobId: string) => {
    try {
      const result = await dataEngineeringAPI.getExecutionStatus(jobId);
      setExecutionResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check execution status');
      throw err;
    }
  }, []);

  return {
    executionResult,
    loading,
    error,
    executeCode,
    submitSolution,
    checkExecutionStatus,
  };
};

// Hook for managing user progress
export const useUserProgress = (userId: string) => {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await dataEngineeringAPI.getUserProgress(userId);
      setProgress(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user progress');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    loading,
    error,
    refetch: fetchProgress,
  };
};

// Hook for managing dashboard data
export const useDashboard = (userId: string) => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await dataEngineeringAPI.getUserDashboard(userId);
      setDashboardData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboardData,
    loading,
    error,
    refetch: fetchDashboard,
  };
};

// Hook for health check
export const useHealthCheck = () => {
  const [status, setStatus] = useState<{ status: string; service: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataEngineeringAPI.healthCheck();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    status,
    loading,
    error,
    refetch: checkHealth,
  };
};