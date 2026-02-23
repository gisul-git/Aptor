import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * API route to provide SQL engine URL at runtime
 * This allows the URL to be configured in Azure App Service without rebuilding
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get SQL engine URL from environment variable (server-side)
  // This can be set in Azure App Service Configuration
  const sqlEngineUrl = process.env.SQL_ENGINE_URL || process.env.NEXT_PUBLIC_SQL_ENGINE_URL;

  if (!sqlEngineUrl) {
    return res.status(500).json({ 
      error: 'SQL_ENGINE_URL environment variable is not configured',
      url: null 
    });
  }

  // Return the URL (this is safe to expose as it's just a service endpoint)
  return res.status(200).json({ 
    url: sqlEngineUrl,
    success: true 
  });
}

