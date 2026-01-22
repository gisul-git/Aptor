import axios from 'axios'
import { getSession } from 'next-auth/react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80' // API Gateway

// Cache the last known good token so we don't depend on NextAuth timing on every request.
let cachedBackendToken: string | null = null

export const aimlApi = axios.create({
  baseURL: `${API_URL}/api/v1/aiml`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests - CRITICAL: All AIML API calls require authentication
aimlApi.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      if (config.headers?.Authorization) return config

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

