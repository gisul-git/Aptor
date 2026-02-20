import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import axios from 'axios';

/**
 * API route to fetch organization details by orgId
 * This route proxies the request to the employee service
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const session = await getSession({ req });
    
    if (!session?.backendToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ message: 'Organization ID is required' });
    }

      // Call the employee service to get organization details
      // Use the API Gateway URL from environment or default
      const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://api-gateway:80';
      const response = await axios.get(
        `${apiGatewayUrl}/api/v1/employees/organizations/${orgId}`,
        {
          headers: {
            Authorization: `Bearer ${session.backendToken}`,
            'X-User-Id': (session.user as any)?.id || '',
            'X-Org-Id': orgId,
            'X-Role': (session.user as any)?.role || 'org_admin',
          },
        }
      );

      return res.status(200).json({
        success: true,
        data: response.data.data || response.data,
      });
  } catch (error: any) {
    console.error('Error in organization API route:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Internal server error',
    });
  }
}

