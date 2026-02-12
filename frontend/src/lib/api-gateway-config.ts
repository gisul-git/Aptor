/**
 * Utility to get API Gateway URL at runtime
 * This fetches from an API route so the URL can be configured in Azure without rebuilding
 */

let cachedUrl: string | null = null;
let fetchPromise: Promise<string> | null = null;

/**
 * Get API Gateway URL from API route (runtime configuration)
 * Falls back to NEXT_PUBLIC_API_URL if API route fails
 */
export async function getApiGatewayUrl(): Promise<string> {
  // Return cached URL if available
  if (cachedUrl) {
    return cachedUrl;
  }

  // If there's already a fetch in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  // Fetch from API route
  fetchPromise = (async () => {
    try {
      const response = await fetch('/api/config/api-gateway-url');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch API Gateway URL: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.url) {
        cachedUrl = data.url;
        return data.url;
      }

      throw new Error('API Gateway URL not found in API response');
    } catch (error) {
      console.warn('[API Gateway Config] Failed to fetch from API route, falling back to NEXT_PUBLIC_API_URL:', error);
      
      // Fallback to build-time environment variable
      const fallbackUrl = process.env.NEXT_PUBLIC_API_URL;
      
      if (fallbackUrl) {
        cachedUrl = fallbackUrl;
        return fallbackUrl;
      }

      throw new Error(
        'API_GATEWAY_URL environment variable is not configured. ' +
        'Please set API_GATEWAY_URL in Azure App Service Configuration or NEXT_PUBLIC_API_URL in your .env file.'
      );
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Clear cached URL (useful for testing or when URL changes)
 */
export function clearApiGatewayUrlCache() {
  cachedUrl = null;
  fetchPromise = null;
}

