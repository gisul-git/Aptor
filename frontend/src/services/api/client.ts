import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import { checkTokenExpiration } from '@/lib/jwt';


const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '', // Empty = relative URLs (use Next.js proxy)
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds (2 minutes) timeout
});

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Proactively refresh token if it's expired or expiring soon
 */
async function refreshTokenProactively(): Promise<string | null> {
  if (isRefreshing) {
    // Already refreshing, wait for it
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const session = await getSession();
    let refreshToken = (session as any)?.refreshToken;

    // Fallback: check sessionStorage for temp refresh token
    if (!refreshToken && typeof window !== 'undefined') {
      try {
        refreshToken = sessionStorage.getItem('temp_refresh_token');
      } catch (e) {
        // Ignore storage errors
      }
    }

    if (!refreshToken) {
      processQueue(new Error('No refresh token available'), null);
      return null;
    }

    // Call refresh token endpoint
    // Use relative URL to leverage Next.js proxy
    const refreshUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh-token`
      : '/api/v1/auth/refresh-token';
    const response = await axios.post(refreshUrl, { refreshToken });

    const newAccessToken = response.data?.data?.token;
    const newRefreshToken = response.data?.data?.refreshToken;

    if (newAccessToken) {
      // Store new tokens in sessionStorage for immediate use
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('temp_access_token', newAccessToken);
          if (newRefreshToken) {
            sessionStorage.setItem('temp_refresh_token', newRefreshToken);
          }
        } catch (e) {
          // Ignore storage errors
        }
      }

      // Trigger session update by dispatching a custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('token-refreshed', {
            detail: {
              backendToken: newAccessToken,
              refreshToken: newRefreshToken || refreshToken,
            }
          })
        );
      }

      processQueue(null, newAccessToken);
      return newAccessToken;
    } else {
      throw new Error('Failed to refresh token');
    }
  } catch (refreshError) {
    processQueue(refreshError, null);
    // Refresh failed, redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/signin';
    }
    return null;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Request Interceptor
 * - Adds authentication token to requests
 * - Handles token refresh proactively
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Only add token for admin API routes (not auth routes or candidate assessment routes)
    // Candidate assessment routes use token from URL params, not JWT
    const isAuthRoute = config.url?.includes('/api/v1/auth/') || config.url?.includes('/api/auth/');
    const isCandidateRoute = config.url?.includes('/api/assessment/') || config.url?.includes('/api/v1/candidate/');
    
    if (!isAuthRoute && !isCandidateRoute && typeof window !== 'undefined') {
      // Check for temporary token first (from recent refresh)
      let token: string | null = null;
      try {
        token = sessionStorage.getItem('temp_access_token');
      } catch (e) {
        // Ignore storage errors
      }
      
      // If no temp token, get from session
      if (!token) {
        const session = await getSession();
        token = session?.backendToken || null;
      }

      // Check if token is expired or expiring soon (within 5 minutes)
      if (token) {
        const tokenStatus = checkTokenExpiration(token, 5);
        
        // If token is expired or expiring soon, refresh it proactively
        if (tokenStatus.isExpired || tokenStatus.isExpiringSoon) {
          const newToken = await refreshTokenProactively();
          if (newToken) {
            token = newToken;
          } else if (tokenStatus.isExpired) {
            // Token is expired and refresh failed, redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/signin';
            }
            return Promise.reject(new Error('Token expired and refresh failed'));
          }
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * - Handles 401 errors with automatic token refresh
 * - Standardizes error responses
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      
      // Use the proactive refresh function
      const newToken = await refreshTokenProactively();
      
      if (newToken) {
        // Update the request with new access token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        // Retry the original request
        return apiClient(originalRequest);
      } else {
        // Refresh failed, error already handled in refreshTokenProactively
        return Promise.reject(error);
      }
    }

    // Extract error message from different possible response structures
    let message = error.message;
    
    // Enhanced error logging
    console.error('🔴 [API Client] Request Error:', {
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      errorCode: error.code,
      errorMessage: error.message,
      requestHeaders: error.config?.headers,
      responseHeaders: error.response?.headers,
    });
    
    if (error.response?.data) {
      // Try different possible error message fields
      message = (error.response.data as any).detail || 
                (error.response.data as any).message || 
                (error.response.data as any).error ||
                (error.response.data as any).msg ||
                error.message;
      
      // Handle array of messages
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
      
      console.error('🔴 [API Client] Extracted error message:', {
        originalMessage: error.message,
        extractedMessage: message,
        responseData: error.response.data,
      });
    }
    
    // Log connection errors specifically
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || !error.response) {
      console.error('🔴 [API Client] Connection Error:', {
        code: error.code,
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config?.url,
        isNetworkError: !error.response,
      });
    }
    
    return Promise.reject(new Error(message || 'An error occurred. Please try again.'));
  }
);

export default apiClient;




