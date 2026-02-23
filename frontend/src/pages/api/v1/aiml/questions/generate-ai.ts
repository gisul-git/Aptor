import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API Gateway URL from environment or use default
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 
                         process.env.NEXT_PUBLIC_API_URL || 
                         (process.env.NODE_ENV === 'production' 
                           ? 'http://api-gateway:80'
                           : 'http://localhost:80');

    console.log('[API Route] Proxying to API Gateway:', {
      url: `${apiGatewayUrl}/api/v1/aiml/questions/generate-ai`,
      method: req.method,
      hasBody: !!req.body,
    });

    const response = await axios.post(
      `${apiGatewayUrl}/api/v1/aiml/questions/generate-ai`,
      req.body,
      {
        timeout: 300000, // 5 minutes
        headers: {
          'Content-Type': 'application/json',
          // Forward authorization header if present
          ...(req.headers.authorization && { Authorization: req.headers.authorization }),
          // Forward other relevant headers
          ...(req.headers['x-user-id'] && { 'X-User-Id': req.headers['x-user-id'] as string }),
          ...(req.headers['x-org-id'] && { 'X-Org-Id': req.headers['x-org-id'] as string }),
          ...(req.headers['x-role'] && { 'X-Role': req.headers['x-role'] as string }),
        },
      }
    );

    console.log('[API Route] Success:', {
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : null,
    });

    return res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('[API Route] Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      responseData: error.response?.data,
    });
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ 
        error: 'Request timeout - AI generation taking too long',
        code: 'TIMEOUT',
      });
    }
    
    if (error.code === 'ECONNRESET') {
      return res.status(502).json({
        error: 'Connection reset - API Gateway closed the connection prematurely',
        code: 'CONNECTION_RESET',
      });
    }
    
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.response?.data?.message || error.message,
      code: error.code || 'UNKNOWN_ERROR',
    });
  }
}
