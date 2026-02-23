import axios from 'axios';
import { getSession } from 'next-auth/react';

// Add request interceptor to inject authentication token
axios.interceptors.request.use(
  async (config) => {
    // Get the current session
    const session = await getSession();
    
    // If session has a backend token, add it to the Authorization header
    if (session?.backendToken) {
      config.headers.Authorization = `Bearer ${session.backendToken}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh on 401
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If we get a 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Get the latest session (it might have been refreshed by SessionRefreshListener)
        const session = await getSession();
        
        if (session?.backendToken) {
          // Update the failed request with the new token
          originalRequest.headers.Authorization = `Bearer ${session.backendToken}`;
          
          // Retry the original request
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        // Redirect to login if token refresh fails
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/signin';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios;
