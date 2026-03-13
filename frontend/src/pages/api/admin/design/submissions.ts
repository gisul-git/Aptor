/**
 * API Route: Get all design submissions for admin panel
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch submissions from backend
    const response = await fetch('http://localhost:3006/api/v1/design/sessions/list');
    
    if (!response.ok) {
      throw new Error('Failed to fetch submissions');
    }

    const data = await response.json();
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return res.status(500).json({ error: error.message });
  }
}
