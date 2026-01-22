import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { testId } = req.query

  if (!testId || typeof testId !== 'string') {
    return res.status(400).json({ message: 'Test ID is required' })
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/aiml/tests/${testId}/pause`,
      {},
      {
        headers: {
          Authorization: req.headers.authorization || '',
        },
      }
    )

    return res.status(200).json(response.data)
  } catch (error: any) {
    console.error('Error in pause AIML test API route:', error)
    return res.status(error.response?.status || 500).json({
      message:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to pause AIML test',
    })
  }
}

