import apiClient from '../api/client';

interface FaceVerificationRequest {
  assessmentId: string;
  candidateId: string;
  referenceImage: string;  // Base64 data URL
  liveImage: string;       // Base64 data URL
}

interface FaceVerificationResponse {
  success: boolean;
  match: boolean;
  similarity: number;      // 0-100 scale
  confidence: number;
  reason: string;
  metadata: {
    embeddingDim?: number;
    provider: string;
    model?: string;
    timestamp: string;
    assessmentId: string;
    candidateId: string;
  };
}

/**
 * Face Verification Service
 * Calls backend proctoring-service for Tier 2 verification using DeepFace ArcFace
 */
class FaceVerificationService {
  private readonly ENDPOINT = '/api/v1/proctor/verify-face';
  private readonly TIMEOUT_MS = 10000;  // 10 second timeout

  /**
   * Verify if live frame matches reference face (Tier 2 - Backend DeepFace ArcFace)
   */
  async verifyFace(
    assessmentId: string,
    candidateId: string,
    referenceImage: string,
    liveImage: string
  ): Promise<FaceVerificationResponse> {
    try {
      const request: FaceVerificationRequest = {
        assessmentId,
        candidateId,
        referenceImage,
        liveImage
      };

      console.log('[FaceVerificationService] 📡 Calling backend (Tier 2)...', {
        assessmentId,
        candidateId,
        referenceSize: `${(referenceImage.length / 1024).toFixed(1)} KB`,
        liveSize: `${(liveImage.length / 1024).toFixed(1)} KB`
      });

      const startTime = Date.now();

      const response = await apiClient.post<FaceVerificationResponse>(
        this.ENDPOINT,
        request,
        { timeout: this.TIMEOUT_MS }
      );

      const duration = Date.now() - startTime;

      console.log('[FaceVerificationService] ✅ Backend response (Tier 2):', {
        match: response.data.match,
        similarity: response.data.similarity.toFixed(2),
        confidence: response.data.confidence,
        provider: response.data.metadata?.provider,
        duration: `${duration}ms`
      });

      return response.data;

    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; response?: { data?: { detail?: string; error?: string } } };
      console.error('[FaceVerificationService] ❌ Backend verification failed:', err);

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        throw new Error('Backend verification timeout - please check your connection');
      }

      if (err.response?.data) {
        throw new Error(err.response.data.detail || err.response.data.error || 'Backend verification failed');
      }

      throw new Error('Backend verification service unavailable');
    }
  }
}

export const faceVerificationService = new FaceVerificationService();
