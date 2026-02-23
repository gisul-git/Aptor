/**
 * API Route: /api/proctor/upload
 * 
 * Handles snapshot uploads as multipart/form-data and forwards to backend.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

// Disable body parsing to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://localhost:80';

interface ParsedFormData {
  file: formidable.File | null;
  metadata: string;
}

async function parseForm(req: NextApiRequest): Promise<ParsedFormData> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const metadata = Array.isArray(fields.metadata) 
        ? fields.metadata[0] 
        : fields.metadata || '{}';

      resolve({
        file: file || null,
        metadata: metadata as string,
      });
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const { file, metadata } = await parseForm(req);

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse metadata
    let metadataObj: Record<string, unknown>;
    try {
      metadataObj = JSON.parse(metadata);
    } catch {
      return res.status(400).json({ error: 'Invalid metadata JSON' });
    }

    console.log('[ProctorUpload API] Received upload:', {
      fileSize: file.size,
      mimetype: file.mimetype,
      eventType: metadataObj.eventType,
      assessmentId: metadataObj.assessmentId,
    });

    // Read file content
    const fileBuffer = fs.readFileSync(file.filepath);
    const base64Data = fileBuffer.toString('base64');

    // Forward to backend - ensure userId is set (map from candidateId if needed)
    const userId = metadataObj.userId || metadataObj.candidateId || '';
    
    const backendPayload = {
      snapshotBase64: `data:${file.mimetype || 'image/jpeg'};base64,${base64Data}`,
      eventType: metadataObj.eventType,
      timestamp: metadataObj.timestamp || new Date().toISOString(),
      assessmentId: metadataObj.assessmentId,
      userId: userId,
    };

    console.log('[ProctorUpload API] Forwarding to backend:', {
      eventType: backendPayload.eventType,
      assessmentId: backendPayload.assessmentId,
      userId: backendPayload.userId,
      hasSnapshot: !!backendPayload.snapshotBase64,
    });

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/proctor/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendPayload),
    });

    // Clean up temp file
    try {
      fs.unlinkSync(file.filepath);
    } catch {
      // Ignore cleanup errors
    }

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('[ProctorUpload API] Backend error:', backendResponse.status, errorText);
      return res.status(backendResponse.status).json({ 
        error: 'Backend error', 
        details: errorText 
      });
    }

    const result = await backendResponse.json();
    console.log('[ProctorUpload API] Upload successful:', result);

    return res.status(200).json({
      status: 'ok',
      id: result.id || result.snapshotId,
    });
  } catch (error) {
    console.error('[ProctorUpload API] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
