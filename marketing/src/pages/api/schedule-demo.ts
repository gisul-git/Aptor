import type { NextApiRequest, NextApiResponse } from 'next'

interface ScheduleDemoRequest {
  firstName: string
  lastName: string
  email: string
  company: string
  phone: string
  country: string
  jobTitle: string
  companySize: string
  competencies: string[]
  whatsapp: boolean
  privacyAgreed: boolean
  marketingConsent: boolean
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  try {
    const formData: ScheduleDemoRequest = req.body

    // Validate required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.company ||
      !formData.phone ||
      !formData.country ||
      !formData.jobTitle ||
      !formData.companySize
    ) {
      return res.status(400).json({
        message: 'All required fields must be filled',
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      return res.status(400).json({
        message: 'Invalid email format',
      })
    }

    // Validate at least one competency is selected
    if (!formData.competencies || formData.competencies.length === 0) {
      return res.status(400).json({
        message: 'Please select at least one competency of interest',
      })
    }

    // Validate privacy agreement
    if (!formData.privacyAgreed) {
      return res.status(400).json({
        message: 'You must agree to the Privacy Policy and Terms of Service',
      })
    }

    // Forward request to demo-service
    // Try API Gateway first, fallback to direct service call in development
    const apiGatewayUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_GATEWAY_URL || 'http://localhost:80'
    const demoServiceUrl = process.env.DEMO_SERVICE_URL || 'http://localhost:3008'
    
    // In development, try direct service call if gateway fails
    const useDirectService = process.env.NODE_ENV === 'development' && !apiGatewayUrl.includes('localhost:80')
    
    let targetUrl = useDirectService 
      ? `${demoServiceUrl}/api/v1/demo/schedule`
      : `${apiGatewayUrl}/api/v1/demo/schedule`
    
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      const result = await response.json()

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: result.message || 'Failed to submit demo request',
          errors: result.errors,
        })
      }

      return res.status(200).json({
        success: true,
        message: result.message || 'Demo request submitted successfully',
        data: result.data,
      })
    } catch (fetchError: any) {
      // If API Gateway failed and we're in development, try direct service call
      if (
        process.env.NODE_ENV === 'development' &&
        !useDirectService &&
        (fetchError.cause?.code === 'ECONNREFUSED' || fetchError.code === 'ECONNREFUSED')
      ) {
        console.log('[Schedule Demo] API Gateway unavailable, trying direct service call...')
        try {
          const directResponse = await fetch(`${demoServiceUrl}/api/v1/demo/schedule`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            signal: AbortSignal.timeout(10000),
          })

          const directResult = await directResponse.json()

          if (!directResponse.ok) {
            return res.status(directResponse.status).json({
              success: false,
              message: directResult.message || 'Failed to submit demo request',
              errors: directResult.errors,
            })
          }

          return res.status(200).json({
            success: true,
            message: directResult.message || 'Demo request submitted successfully',
            data: directResult.data,
          })
        } catch (directError: any) {
          console.error('[Schedule Demo] Direct service call also failed:', directError)
          // Fall through to error handling below
        }
      }

      console.error('[Schedule Demo] Error calling demo-service:', {
        message: fetchError.message,
        code: fetchError.cause?.code || fetchError.code,
        url: targetUrl,
      })
      
      // Provide helpful error message
      if (fetchError.cause?.code === 'ECONNREFUSED' || fetchError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'Demo service is not running. Please start the demo-service on port 3008.',
          error: 'ECONNREFUSED',
          ...(process.env.NODE_ENV === 'development' && {
            hint: 'Run: cd services/demo-service && npm run dev',
            attemptedUrl: targetUrl,
          }),
        })
      }
      
      return res.status(503).json({
        success: false,
        message: 'Demo service unavailable. Please try again later.',
        error: fetchError.message,
      })
    }
  } catch (error) {
    console.error('[Schedule Demo] Error processing request:', error)
    return res.status(500).json({
      message: 'Internal server error. Please try again later.',
    })
  }
}

