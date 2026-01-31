import axios from 'axios'
import { getSession } from 'next-auth/react'
import { getApiGatewayUrl } from '@/lib/api-gateway-config'

// Cache the last known good token so we don't depend on NextAuth timing on every request.
let cachedBackendToken: string | null = null

// Create axios instance with dynamic baseURL
export const aimlApi = axios.create({
  baseURL: '', // Will be set dynamically
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor to set baseURL dynamically from runtime config
let baseUrlPromise: Promise<string> | null = null
aimlApi.interceptors.request.use(
  async (config) => {
    // If baseURL is not set, fetch it from runtime config
    if (!config.baseURL || config.baseURL === '') {
      if (!baseUrlPromise) {
        baseUrlPromise = getApiGatewayUrl().then(url => {
          aimlApi.defaults.baseURL = `${url}/api/v1/aiml`
          return url
        })
      }
      await baseUrlPromise
      config.baseURL = aimlApi.defaults.baseURL
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Add token to requests - CRITICAL: Skip auth for public candidate endpoints
aimlApi.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      if (config.headers?.Authorization) return config

      // Check if this is a public candidate endpoint (no JWT auth required)
      // These endpoints use token-based auth via URL parameters
      const url = config.url || ''
      const isPublicCandidateEndpoint = 
        url.includes('/verify-link') ||
        url.includes('/verify-candidate') ||
        url.includes('/start') ||
        url.includes('/public') ||
        url.includes('/full') ||
        url.includes('/candidate') ||
        url.includes('/submit-answer') ||
        url.includes('/submit') ||
        url.includes('/get-reference-photo') ||
        url.includes('/save-reference-face')

      // Skip authentication for public candidate endpoints
      if (isPublicCandidateEndpoint) {
        console.debug('[aimlApi] Skipping auth for public candidate endpoint:', config.url)
        return config
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
        console.warn('[aimlApi] NextAuth session not available, using localStorage fallback')
      }
      
      if (!token) {
        try {
          token = localStorage.getItem('token')
        } catch (e) {
          console.warn('[aimlApi] localStorage not available')
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
        console.debug('[aimlApi] Authorization token added to request:', config.url)
      } else {
        console.error('[aimlApi] SECURITY WARNING: No authentication token found for AIML API request:', config.url)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle 401 errors (unauthorized)
aimlApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/auth/signin'
      }
    }
    return Promise.reject(error)
  }
)

export default aimlApi

