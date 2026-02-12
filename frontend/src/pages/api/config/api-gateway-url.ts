import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * API route to provide API Gateway URL at runtime
 * This allows the URL to be configured in Azure App Service without rebuilding
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API Gateway URL from environment variable (server-side)
  // Priority: NEXT_PUBLIC_API_URL (for client-side HTTPS) > API_GATEWAY_URL (for server-side internal)
  // This can be set in Azure App Service Configuration
  const apiGatewayUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_GATEWAY_URL;

  if (!apiGatewayUrl) {
    return res.status(500).json({ 
      error: 'API_GATEWAY_URL environment variable is not configured',
      url: null 
    });
  }

  // Return the URL (this is safe to expose as it's just a service endpoint)
  return res.status(200).json({ 
    url: apiGatewayUrl,
    success: true 
  });
}

