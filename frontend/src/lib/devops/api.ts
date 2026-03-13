import axios from 'axios'
import { getSession } from 'next-auth/react'
import { getApiGatewayUrl } from '@/lib/api-gateway-config'

// Cache the last known good token so we don't depend on NextAuth timing on every request.
let cachedBackendToken: string | null = null

// Create axios instance with dynamic baseURL
export const devopsApi = axios.create({
  baseURL: '', // Will be set dynamically
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor to set baseURL dynamically from runtime config
let baseUrlPromise: Promise<string> | null = null
devopsApi.interceptors.request.use(
  async (config) => {
    // If baseURL is not set, fetch it from runtime config
    if (!config.baseURL || config.baseURL === '') {
      if (!baseUrlPromise) {
        baseUrlPromise = getApiGatewayUrl().then(url => {
          devopsApi.defaults.baseURL = `${url}/api/v1/devops`
          return url
        })
      }
      await baseUrlPromise
      config.baseURL = devopsApi.defaults.baseURL
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Add token to requests - CRITICAL: Skip auth for public candidate endpoints
devopsApi.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      if (config.headers?.Authorization) return config

      // Check if this is a public candidate endpoint (no JWT auth required)
      // These endpoints use token-based auth via URL parameters
      // NOTE: /add-candidate is an ADMIN endpoint and requires authentication
      const url = config.url || ''
      
      // Explicitly exclude admin endpoints that require authentication
      // These endpoints contain "candidate" but are admin-only and require auth
      const isAdminEndpoint = 
        url.includes('/add-candidate') ||
        url.includes('/candidates') ||  // GET /candidates (plural) is admin-only
        url.includes('/bulk-add-candidates') ||
        url.includes('/send-invitation') ||
        url.includes('/send-feedback')
      
      if (isAdminEndpoint) {
        // This is an admin endpoint - require authentication (continue to token logic below)
      } else {
        // Check if it's a public candidate endpoint
        // NOTE: /candidate (singular) is public, but /candidates (plural) is admin-only
        const isPublicCandidateEndpoint = 
          url.includes('/verify-link') ||
          url.includes('/verify-candidate') ||
          url.includes('/start') ||
          url.includes('/public') ||
          url.includes('/full') ||
          (url.includes('/candidate') && !url.includes('/candidates')) ||  // Only singular /candidate, not plural
          url.includes('/submit-answer') ||
          url.includes('/submit') ||
          url.includes('/get-reference-photo') ||
          url.includes('/save-reference-face')
        
        // Skip authentication for public candidate endpoints
        if (isPublicCandidateEndpoint) {
          console.debug('[devopsApi] Skipping auth for public candidate endpoint:', config.url)
          return config
        }
      }

      let token: string | null = null
      // Use cached token first (fast path)
      try {
        if (cachedBackendToken) token = cachedBackendToken

        if (!token) {
          const session = await Promise.race([
            getSession(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ])
          if (session?.backendToken) {
            token = session.backendToken
            cachedBackendToken = token
          }
        }
      } catch (e) {
        console.warn('[devopsApi] NextAuth session not available, using localStorage fallback')
      }
      
      if (!token) {
        try {
          token = localStorage.getItem('token')
        } catch (e) {
          console.warn('[devopsApi] localStorage not available')
        }
      }
      
      if (!token) {
        try {
          token = sessionStorage.getItem('temp_access_token')
        } catch (e) {
          // Ignore
        }
      }
      
      if (token) {
        cachedBackendToken = token
        config.headers.Authorization = `Bearer ${token}`
        console.debug('[devopsApi] Authorization token added to request:', config.url)
      } else {
        console.error('[devopsApi] SECURITY WARNING: No authentication token found for DevOps API request:', config.url)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle 401 errors (unauthorized) - but don't redirect for public candidate endpoints
devopsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if this is a public candidate endpoint - never redirect to login for these
    const url = error.config?.url || ''
    const fullUrl = error.config?.baseURL ? `${error.config.baseURL}${url}` : url
    const requestUrl = error.request?.responseURL || fullUrl || url
    const allUrls = [url, fullUrl, requestUrl].filter(Boolean).join(' ')
    
    const isPublicCandidateEndpoint = 
      allUrls.includes('/verify-link') ||
      allUrls.includes('/verify-candidate') ||
      allUrls.includes('/start') ||
      allUrls.includes('/public') ||
      allUrls.includes('/full') ||
      allUrls.includes('/candidate') ||
      allUrls.includes('/submit-answer') ||
      allUrls.includes('/submit') ||
      allUrls.includes('/get-reference-photo') ||
      allUrls.includes('/save-reference-face')
    
    // Only handle 401 for admin endpoints - public candidate endpoints should never redirect
    if (error.response?.status === 401 && !isPublicCandidateEndpoint && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/auth/signin'
    }
    // For all other cases (including public candidate endpoints with any error), just reject without redirecting
    return Promise.reject(error)
  }
)

export default devopsApi

export const devopsCandidateApi = {
  verifyCandidate: async (
    testId: string,
    token: string,
    email: string,
    name: string
  ): Promise<{ verified: boolean; accessMode: string; candidate?: Record<string, unknown> }> => {
    const response = await devopsApi.post(`/tests/${testId}/verify-candidate`, {
      token,
      email,
      name,
    })

    if (response.data?.success && response.data?.data) {
      return response.data.data
    }

    throw new Error(response.data?.message || response.data?.detail || 'Failed to verify candidate')
  },
}


