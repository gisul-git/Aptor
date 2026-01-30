/**
 * Utility to get SQL engine URL at runtime
 * This fetches from an API route so the URL can be configured in Azure without rebuilding
 */

let cachedUrl: string | null = null;
let fetchPromise: Promise<string> | null = null;

/**
 * Get SQL engine URL from API route (runtime configuration)
 * Falls back to NEXT_PUBLIC_SQL_ENGINE_URL if API route fails
 */
export async function getSqlEngineUrl(): Promise<string> {
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
      const response = await fetch('/api/config/sql-engine-url');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch SQL engine URL: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.url) {
        cachedUrl = data.url;
        return data.url;
      }

      throw new Error('SQL engine URL not found in API response');
    } catch (error) {
      console.warn('[SQL Engine Config] Failed to fetch from API route, falling back to NEXT_PUBLIC_SQL_ENGINE_URL:', error);
      
      // Fallback to build-time environment variable
      const fallbackUrl = process.env.NEXT_PUBLIC_SQL_ENGINE_URL;
      
      if (fallbackUrl) {
        cachedUrl = fallbackUrl;
        return fallbackUrl;
      }

      throw new Error(
        'SQL_ENGINE_URL environment variable is not configured. ' +
        'Please set SQL_ENGINE_URL in Azure App Service Configuration or NEXT_PUBLIC_SQL_ENGINE_URL in your .env file.'
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
export function clearSqlEngineUrlCache() {
  cachedUrl = null;
  fetchPromise = null;
}

