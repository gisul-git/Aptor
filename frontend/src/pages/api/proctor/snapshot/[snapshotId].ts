/**
 * API Route: /api/proctor/snapshot/[snapshotId]
 * 
 * Retrieves a snapshot by its ID from the backend.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:80';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { snapshotId } = req.query;

  if (!snapshotId || typeof snapshotId !== 'string') {
    return res.status(400).json({ error: 'Missing snapshotId' });
  }

  try {
    console.log('[Snapshot API] Fetching snapshot:', snapshotId);

    const response = await fetch(`${BACKEND_URL}/api/v1/proctor/snapshot/${snapshotId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }
      const errorText = await response.text();
      console.error('[Snapshot API] Backend error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Backend error' });
    }

    const data = await response.json();
    
    return res.status(200).json({
      snapshotBase64: data.snapshotBase64,
      contentType: data.contentType || 'image/jpeg',
    });
  } catch (error) {
    console.error('[Snapshot API] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
