import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Auth Service
 * 
 * Handles all authentication-related API calls
 * Routes: /api/v1/auth
 */

// Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  require_mfa?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'org_admin' | 'user';
  organization?: {
    id: string;
    name: string;
  };
  phone?: string;
  country?: string;
  avatar?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export interface VerifyTokenResponse {
  userId: string;
  orgId?: string;
  role: string;
}

export const authService = {
  /**
   * Login with email and password
   */
  login: async (credentials: LoginCredentials): Promise<ApiResponse<LoginResponse>> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/api/v1/auth/login',
      credentials
    );
    return response.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<ApiResponse<RefreshTokenResponse>> => {
    const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>(
      '/api/v1/auth/refresh-token',
      { refreshToken }
    );
    return response.data;
  },

  /**
   * Verify token (used by API Gateway)
   */
  verifyToken: async (token: string): Promise<ApiResponse<VerifyTokenResponse>> => {
    const response = await apiClient.post<ApiResponse<VerifyTokenResponse>>(
      '/api/v1/auth/verify',
      { token }
    );
    return response.data;
  },

  /**
   * OAuth login
   */
  oauthLogin: async (data: {
    email: string;
    name: string;
    provider: string;
  }): Promise<ApiResponse<LoginResponse>> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/api/v1/auth/oauth-login',
      data
    );
    return response.data;
  },

  /**
   * Get current user
   */
  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/api/v1/users/me');
    return response.data;
  },

  /**
   * Logout (client-side only, server invalidates token)
   */
  logout: async (): Promise<void> => {
    // Client-side logout - clear tokens
    // Server-side token invalidation should be handled by backend
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.removeItem('token');
    }
  },
};




