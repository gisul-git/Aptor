import axios from 'axios'
import { getSession } from 'next-auth/react'
import { getApiGatewayUrl } from '@/lib/api-gateway-config'

// Cache the last known good token so we don't depend on NextAuth timing on every request.
let cachedBackendToken: string | null = null

// Create axios instance with dynamic baseURL
export const dsaApi = axios.create({
  baseURL: '', // Will be set dynamically
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor to set baseURL dynamically from runtime config
let baseUrlPromise: Promise<string> | null = null
dsaApi.interceptors.request.use(
  async (config) => {
    // If baseURL is not set, fetch it from runtime config
    if (!config.baseURL || config.baseURL === '') {
      if (!baseUrlPromise) {
        baseUrlPromise = getApiGatewayUrl().then(url => {
          dsaApi.defaults.baseURL = `${url}/api/v1/dsa`
          return url
        })
      }
      await baseUrlPromise
      config.baseURL = dsaApi.defaults.baseURL
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Add token to requests - CRITICAL: Skip auth for public candidate endpoints
dsaApi.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      // If Authorization already set by caller, respect it.
      if (config.headers?.Authorization) return config

      // Check if this is a public candidate endpoint (no JWT auth required)
      // These endpoints use token-based auth via URL parameters
      const url = config.url || ''
      const isPublicCandidateEndpoint = 
        url.includes('/verify-link') ||
        url.includes('/verify-candidate') ||
        url.includes('/start') ||
        url.includes('/public') ||
        url.includes('/submission') ||
        url.includes('/question/') ||
        url.includes('/final-submit') ||
        url.includes('/full') ||
        url.includes('/get-reference-photo') ||
        url.includes('/save-reference-face')

      // Skip authentication for public candidate endpoints
      if (isPublicCandidateEndpoint) {
        console.debug('[dsaApi] Skipping auth for public candidate endpoint:', config.url)
        return config
      }

      // Try to get token from NextAuth session first, fallback to localStorage
      let token: string | null = null
      
      try {
        // Use cached token first (fast path)
        if (cachedBackendToken) token = cachedBackendToken

        // For editor/admin pages we should wait a bit longer for NextAuth to hydrate.
        // Candidate public flows typically pass their own token in the URL and don't rely on NextAuth.
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
        // NextAuth not available or error, use localStorage
        console.warn('[dsaApi] NextAuth session not available, using localStorage fallback')
      }
      
      // Fallback to localStorage if session token not available
      if (!token) {
        try {
          token = localStorage.getItem('token')
        } catch (e) {
          console.warn('[dsaApi] localStorage not available')
        }
      }
      
      // Also check sessionStorage for temp token (from token refresh)
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
        console.debug('[dsaApi] Authorization token added to request:', config.url)
      } else {
        console.error('[dsaApi] SECURITY WARNING: No authentication token found for DSA API request:', config.url)
        console.error('[dsaApi] This request will likely fail with 401 Unauthorized')
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle 401 errors (unauthorized)
dsaApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/auth/signin'
      }
    }
    return Promise.reject(error)
  }
)

export default dsaApi

