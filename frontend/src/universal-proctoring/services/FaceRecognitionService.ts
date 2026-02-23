/**
 * Face Recognition Service
 * 
 * Client-side face recognition service using @vladmandic/face-api.
 * Provides face embedding extraction and comparison functionality.
 * 
 * 100% client-side - NO backend calls
 */

import { faceAPIService } from './FaceAPIService';

export interface FaceEmbedding {
  embedding: Float32Array;
  confidence?: number;
}

export interface FaceComparisonResult {
  match: boolean;
  similarity: number; // 0-100 percentage
  distance: number; // Cosine distance (0 = identical, 1 = completely different)
  confidence: number; // 0-1 confidence score
}

export interface FaceRecognitionConfig {
  similarityThreshold: number; // Default: 70% similarity required for match
  minConfidence: number; // Default: 0.5 minimum confidence
}

class FaceRecognitionService {
  private static instance: FaceRecognitionService;
  private readonly config: FaceRecognitionConfig = {
    similarityThreshold: 70, // 70% similarity = match
    minConfidence: 0.5,
  };

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): FaceRecognitionService {
    if (!FaceRecognitionService.instance) {
      FaceRecognitionService.instance = new FaceRecognitionService();
    }
    return FaceRecognitionService.instance;
  }

  /**
   * Initialize the service (loads face-api models)
   */
  async initialize(): Promise<void> {
    await faceAPIService.initialize();
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return faceAPIService.isReady();
  }

  /**
   * Extract face embedding from image
   */
  async extractEmbedding(
    image: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement | string
  ): Promise<FaceEmbedding> {
    await this.initialize();

    let imageData: string;
    
    if (typeof image === 'string') {
      // Base64 data URL
      imageData = image;
    } else {
      // Convert image element to data URL
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      if (image instanceof HTMLVideoElement || image instanceof HTMLImageElement) {
        canvas.width = image instanceof HTMLVideoElement ? image.videoWidth : image.width;
        canvas.height = image instanceof HTMLVideoElement ? image.videoHeight : image.height;
        ctx.drawImage(image, 0, 0);
      } else if (image instanceof HTMLCanvasElement) {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
      } else if (image instanceof ImageData) {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.putImageData(image, 0, 0);
      } else {
        throw new Error('Unsupported image type');
      }
      
      imageData = canvas.toDataURL('image/jpeg');
    }

    const embedding = await faceAPIService.extractEmbedding(imageData);
    
    if (!embedding) {
      throw new Error('Failed to extract face embedding - no face detected');
    }

    return {
      embedding,
      confidence: 1.0, // face-api doesn't provide confidence, use 1.0
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns similarity score (0-1, where 1 = identical)
   */
  private cosineSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Calculate cosine distance between two embeddings
   * Returns distance (0-1, where 0 = identical, 1 = completely different)
   */
  private cosineDistance(embedding1: Float32Array, embedding2: Float32Array): number {
    const similarity = this.cosineSimilarity(embedding1, embedding2);
    // Cosine distance = 1 - cosine similarity
    return 1 - similarity;
  }

  /**
   * Compare two face embeddings
   * @param embedding1 - First face embedding
   * @param embedding2 - Second face embedding
   * @returns Comparison result with match status and similarity score
   */
  compareEmbeddings(
    embedding1: Float32Array,
    embedding2: Float32Array
  ): FaceComparisonResult {
    const similarity = this.cosineSimilarity(embedding1, embedding2);
    const distance = this.cosineDistance(embedding1, embedding2);

    // Convert similarity (0-1) to percentage (0-100)
    const similarityPercent = similarity * 100;

    // Determine if faces match based on threshold
    const match = similarityPercent >= this.config.similarityThreshold;

    return {
      match,
      similarity: similarityPercent,
      distance,
      confidence: similarity, // Use similarity as confidence
    };
  }

  /**
   * Compare two face images
   * Extracts embeddings from both images and compares them
   */
  async compareFaces(
    image1: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement | string,
    image2: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement | string
  ): Promise<FaceComparisonResult> {
    await this.initialize();

    try {
      // Extract embeddings from both images
      const [embedding1, embedding2] = await Promise.all([
        this.extractEmbedding(image1),
        this.extractEmbedding(image2),
      ]);

      // Compare embeddings
      return this.compareEmbeddings(embedding1.embedding, embedding2.embedding);
    } catch (error) {
      console.error('[FaceRecognitionService] Error comparing faces:', error);
      throw new Error(`Face comparison failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify if a live face matches a reference face
   * @param referenceEmbedding - Pre-extracted reference face embedding
   * @param liveImage - Live face image to compare
   * @returns Comparison result
   */
  async verifyFace(
    referenceEmbedding: Float32Array,
    liveImage: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement | string
  ): Promise<FaceComparisonResult> {
    await this.initialize();

    try {
      // Extract embedding from live image
      const liveEmbeddingResult = await this.extractEmbedding(liveImage);
      const currentEmbedding = liveEmbeddingResult.embedding;

      // Use face-api's euclidean distance for comparison
      const distance = faceAPIService.compareEmbeddings(referenceEmbedding, currentEmbedding);
      
      // Convert euclidean distance to similarity (face-api uses euclidean, threshold ~0.6)
      // Lower distance = more similar
      // Typical thresholds: <0.6 = same person, >0.6 = different person
      const threshold = 0.6;
      const match = distance < threshold;
      
      // Convert distance to similarity percentage (inverse relationship)
      // Distance 0 = 100% similarity, Distance 1.0 = 0% similarity
      const similarity = Math.max(0, (1 - distance) * 100);

      return {
        match,
        similarity,
        distance,
        confidence: match ? (1 - distance) : 0,
      };
    } catch (error) {
      console.error('[FaceRecognitionService] Error verifying face:', error);
      return {
        match: false,
        similarity: 0,
        distance: 999,
        confidence: 0,
      };
    }
  }

  /**
   * Update similarity threshold
   */
  setSimilarityThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 100) {
      throw new Error('Similarity threshold must be between 0 and 100');
    }
    this.config.similarityThreshold = threshold;
  }

  /**
   * Get current similarity threshold
   */
  getSimilarityThreshold(): number {
    return this.config.similarityThreshold;
  }
}

// Export singleton instance
export const faceRecognitionService = FaceRecognitionService.getInstance();
export default faceRecognitionService;
