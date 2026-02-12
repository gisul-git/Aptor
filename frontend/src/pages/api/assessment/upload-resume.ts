import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      keepExtensions: true,
    })

    const [fields, files] = await form.parse(req)
    
    const resumeFile = Array.isArray(files.resume) ? files.resume[0] : files.resume
    const assessmentId = Array.isArray(fields.assessmentId) ? fields.assessmentId[0] : fields.assessmentId
    const token = Array.isArray(fields.token) ? fields.token[0] : fields.token
    const email = Array.isArray(fields.email) ? fields.email[0] : fields.email
    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name

    if (!resumeFile || !assessmentId || !email || !name) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(resumeFile.filepath)
    const base64Data = fileBuffer.toString('base64')
    const mimeType = resumeFile.mimetype || 'application/pdf'
    const dataUrl = `data:${mimeType};base64,${base64Data}`

    // Determine assessment type by trying endpoints in order: DSA -> Custom MCQ -> Regular Assessment
    // Try DSA endpoint first
    try {
      console.log(`[upload-resume] Trying DSA endpoint for: ${assessmentId}, email: ${email}`)
      const dsaResponse = await axios.post(
        `${API_BASE_URL}/api/v1/dsa/tests/${assessmentId}/save-candidate-info`,
        {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          hasResume: true,
          resume: dataUrl, // Store resume as base64 data URL
        },
        {
          timeout: 30000, // 30 second timeout for large files
        }
      )
      
      console.log(`[upload-resume] DSA resume upload response :`, dsaResponse.data)
      
      // Clean up temp file
      fs.unlinkSync(resumeFile.filepath)
      
      return res.status(200).json({ success: true, message: 'Resume uploaded successfully', data: dsaResponse.data })
    } catch (dsaError: any) {
      // If DSA endpoint fails with 404, try Custom MCQ endpoint
      if (dsaError.response?.status === 404) {
        try {
          console.log(`[upload-resume] Trying Custom MCQ endpoint for: ${assessmentId}, email: ${email}`)
          const customMcqResponse = await axios.post(
            `${API_BASE_URL}/api/v1/custom-mcq/${assessmentId}/save-candidate-info`,
            {
              email: email.trim().toLowerCase(),
              name: name.trim(),
              token: token,
              hasResume: true,
              resume: dataUrl, // Store resume as base64 data URL
            },
            {
              timeout: 30000, // 30 second timeout for large files
            }
          )
          
          console.log(`[upload-resume] Custom MCQ resume upload response:`, customMcqResponse.data)
          
          // Clean up temp file
          fs.unlinkSync(resumeFile.filepath)
          
          return res.status(200).json({ success: true, message: 'Resume uploaded successfully', data: customMcqResponse.data })
        } catch (customMcqError: any) {
          // If Custom MCQ endpoint also fails with 404, try regular assessment endpoint
          if (customMcqError.response?.status === 404) {
            try {
              console.log(`[upload-resume] Trying regular assessment endpoint for: ${assessmentId}, email: ${email}`)
              const response = await axios.post(
                `${API_BASE_URL}/api/v1/candidate/save-candidate-info`,
                {
                  assessmentId,
                  token,
                  email: email.trim().toLowerCase(),
                  name: name.trim(),
                  hasResume: true,
                  resume: dataUrl, // Store resume as base64 data URL
                },
                {
                  timeout: 30000, // 30 second timeout for large files
                }
              )
              
              // Clean up temp file
              fs.unlinkSync(resumeFile.filepath)
              
              return res.status(200).json({ success: true, message: 'Resume uploaded successfully' })
            } catch (error: any) {
              // Clean up temp file
              if (fs.existsSync(resumeFile.filepath)) {
                fs.unlinkSync(resumeFile.filepath)
              }
              
              return res.status(error.response?.status || 500).json({
                message: error.response?.data?.detail || 'Failed to upload resume',
              })
            }
          } else {
            // Clean up temp file
            if (fs.existsSync(resumeFile.filepath)) {
              fs.unlinkSync(resumeFile.filepath)
            }
            
            return res.status(customMcqError.response?.status || 500).json({
              message: customMcqError.response?.data?.detail || 'Failed to upload resume',
            })
          }
        }
      } else {
        // Clean up temp file
        if (fs.existsSync(resumeFile.filepath)) {
          fs.unlinkSync(resumeFile.filepath)
        }
        
        return res.status(dsaError.response?.status || 500).json({
          message: dsaError.response?.data?.detail || 'Failed to upload resume',
        })
      }
    }
  } catch (error: any) {
    console.error('Error uploading resume:', error)
    return res.status(500).json({ message: 'Failed to upload resume' })
  }
}

