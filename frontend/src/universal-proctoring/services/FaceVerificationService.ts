/**
 * Face Verification Service
 * 
 * Handles face recognition and identity verification by comparing
 * reference photo embeddings with live webcam frame embeddings.
 */

// Face embedding type (128 or 512 dimensional vector)
export type FaceEmbedding = Float32Array | number[];

export interface FaceVerificationResult {
  isMatch: boolean;
  similarity: number; // 0-1, where 1 is perfect match
  confidence: number; // 0-1, confidence in the comparison
}

export interface FaceVerificationConfig {
  similarityThreshold: number; // Minimum similarity to consider a match (default: 0.7)
  checkInterval: number; // How often to check (milliseconds, default: 10000)
  violationDuration: number; // Duration before violation (milliseconds, default: 30000)
}

/**
 * Face Verification Service
 * Extracts face embeddings and compares them for identity verification
 */
export class FaceVerificationService {
  private model: any = null; // Face recognition model (will be loaded from ModelService)
  private isModelLoaded: boolean = false;
  private config: FaceVerificationConfig;

  constructor(config: Partial<FaceVerificationConfig> = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.7,
      checkInterval: config.checkInterval ?? 10000,
      violationDuration: config.violationDuration ?? 30000,
    };
  }

  /**
   * Initialize the face recognition model
   * Model should be loaded via ModelService
   */
  async initialize(model: any): Promise<boolean> {
    try {
      if (!model) {
        console.error("[FaceVerificationService] No model provided");
        return false;
      }

      this.model = model;
      this.isModelLoaded = true;
      console.log("[FaceVerificationService] ✅ Face recognition model initialized");
      return true;
    } catch (error) {
      console.error("[FaceVerificationService] Failed to initialize:", error);
      return false;
    }
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.isModelLoaded && this.model !== null;
  }

  /**
   * Extract face embedding from an image
   * @param image - HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, or ImageData
   * @returns Face embedding vector or null if no face detected
   */
  async extractEmbedding(image: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement): Promise<FaceEmbedding | null> {
    if (!this.isReady()) {
      console.error("[FaceVerificationService] ❌ Model not loaded - cannot extract embedding");
      return null;
    }

    try {
      console.log("[FaceVerificationService] 🔍 Extracting face embedding from image...");
      
      // Use face-api.js model to extract face descriptor
      if (this.model && typeof this.model.getFaceDescriptor === 'function') {
        const descriptor = await this.model.getFaceDescriptor(image);
        
        if (descriptor) {
          console.log("[FaceVerificationService] ✅ Face embedding extracted:", {
            dimensions: descriptor.length,
            type: descriptor.constructor.name,
            sampleValues: Array.from(descriptor.slice(0, 5)), // First 5 values for debugging
          });
          return descriptor;
        } else {
          console.warn("[FaceVerificationService] ⚠️ No face detected in image");
          return null;
        }
      } else if (this.model && typeof this.model.predict === 'function') {
        // Fallback: TensorFlow.js model (if using different model)
        console.log("[FaceVerificationService] Using TensorFlow.js model predict()...");
        const tf = await import("@tensorflow/tfjs");
        const tensor = tf.browser.fromPixels(image as HTMLImageElement | HTMLCanvasElement | HTMLVideoElement);
        const prediction = await this.model.predict(tensor);
        const embedding = await prediction.data();
        tensor.dispose();
        prediction.dispose();
        const embeddingArray = Array.from(embedding) as number[];
        console.log("[FaceVerificationService] ✅ Embedding extracted via TensorFlow.js:", {
          dimensions: embeddingArray.length,
        });
        return embeddingArray;
      }

      console.warn("[FaceVerificationService] ⚠️ Model API not recognized - model type:", typeof this.model);
      return null;
    } catch (error) {
      console.error("[FaceVerificationService] ❌ Error extracting embedding:", error);
      return null;
    }
  }

  /**
   * Compare two face embeddings and calculate similarity
   * Uses combined cosine similarity + Euclidean distance for better accuracy
   * @param embedding1 - Reference embedding
   * @param embedding2 - Live frame embedding
   * @returns Similarity score (0-1) and match result
   */
  compareFaces(embedding1: FaceEmbedding, embedding2: FaceEmbedding): FaceVerificationResult {
    if (!embedding1 || !embedding2) {
      console.warn("[FaceVerificationService] ⚠️ Cannot compare - missing embeddings:", {
        hasEmbedding1: !!embedding1,
        hasEmbedding2: !!embedding2,
      });
      return {
        isMatch: false,
        similarity: 0,
        confidence: 0,
      };
    }

    // Ensure both embeddings are arrays
    const e1 = Array.isArray(embedding1) ? embedding1 : Array.from(embedding1);
    const e2 = Array.isArray(embedding2) ? embedding2 : Array.from(embedding2);

    if (e1.length !== e2.length) {
      console.warn("[FaceVerificationService] ⚠️ Embedding dimensions don't match:", {
        embedding1Length: e1.length,
        embedding2Length: e2.length,
      });
      return {
        isMatch: false,
        similarity: 0,
        confidence: 0,
      };
    }

    // Calculate cosine similarity (angle-based, good for normalized features)
    const cosineSim = this.cosineSimilarity(e1, e2);
    
    // Calculate Euclidean distance (magnitude-based, good for pixel differences)
    const euclideanDist = Math.sqrt(e1.reduce((sum, val, i) => sum + Math.pow(val - e2[i], 2), 0));
    
    // Normalize Euclidean distance to 0-1 (inverse: smaller distance = higher similarity)
    // Use max possible distance as normalization factor (sqrt of sum of squares)
    const maxDist = Math.sqrt(e1.reduce((sum, val) => sum + val * val, 0) + e2.reduce((sum, val) => sum + val * val, 0));
    const normalizedEuclideanSim = maxDist > 0 ? 1 - (euclideanDist / maxDist) : 0;
    
    // Calculate correlation coefficient (linear relationship between features)
    const correlationSim = this.correlationCoefficient(e1, e2);
    
    // Combine all three metrics with optimized weighting for better discrimination
    // Use 50% cosine (for normalized features) + 30% Euclidean (for pixel-level differences) + 20% correlation (for linear relationships)
    // This provides more robust matching by considering multiple similarity perspectives
    const combinedSimilarity = (cosineSim * 0.5) + (normalizedEuclideanSim * 0.3) + (correlationSim * 0.2);
    
    // Additional quality check: Ensure embeddings have sufficient variance
    // Low variance embeddings are less discriminative
    const e1Variance = this.calculateVariance(e1);
    const e2Variance = this.calculateVariance(e2);
    const minVariance = 0.01; // Minimum acceptable variance
    
    if (e1Variance < minVariance || e2Variance < minVariance) {
      console.warn("[FaceVerificationService] ⚠️ Low embedding variance detected:", {
        e1Variance: e1Variance.toFixed(4),
        e2Variance: e2Variance.toFixed(4),
        minVariance,
      });
      // Reduce confidence for low variance embeddings
      const adjustedSimilarity = combinedSimilarity * 0.9; // Penalize by 10%
      const isMatch = adjustedSimilarity >= this.config.similarityThreshold;
      
      console.log("[FaceVerificationService] 📊 Face comparison result (low variance penalty):", {
        cosineSimilarity: cosineSim.toFixed(3),
        euclideanSimilarity: normalizedEuclideanSim.toFixed(3),
        combinedSimilarity: combinedSimilarity.toFixed(3),
        adjustedSimilarity: adjustedSimilarity.toFixed(3),
        threshold: this.config.similarityThreshold,
        isMatch,
        verdict: isMatch ? "✅ MATCH" : "❌ MISMATCH",
      });
      
      return {
        isMatch,
        similarity: adjustedSimilarity,
        confidence: Math.min(1, adjustedSimilarity * 1.0), // Reduced confidence
      };
    }
    
    // Determine if it's a match based on threshold
    const isMatch = combinedSimilarity >= this.config.similarityThreshold;

    // Debug logging with more details
    console.log("[FaceVerificationService] 📊 Face comparison result:", {
      cosineSimilarity: cosineSim.toFixed(3),
      euclideanSimilarity: normalizedEuclideanSim.toFixed(3),
      correlationSimilarity: correlationSim.toFixed(3),
      combinedSimilarity: combinedSimilarity.toFixed(3),
      threshold: this.config.similarityThreshold,
      euclideanDistance: euclideanDist.toFixed(3),
      isMatch,
      embedding1Length: e1.length,
      embedding2Length: e2.length,
      verdict: isMatch ? "✅ MATCH" : "❌ MISMATCH",
    });

    return {
      isMatch,
      similarity: combinedSimilarity, // Use combined similarity
      confidence: Math.min(1, combinedSimilarity * 1.1), // Slightly boost confidence
    };
  }

  /**
   * Calculate variance of a vector (for quality check)
   * @param vec - Vector to calculate variance for
   * @returns Variance value
   */
  private calculateVariance(vec: number[]): number {
    if (vec.length === 0) return 0;
    const mean = vec.reduce((sum, val) => sum + val, 0) / vec.length;
    const variance = vec.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vec.length;
    return variance;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Improved: Uses normalized vectors for better accuracy
   * @param vec1 - First vector
   * @param vec2 - Second vector
   * @returns Cosine similarity (0-1)
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    // Normalize vectors first (L2 normalization) for better accuracy
    const normalize = (v: number[]): number[] => {
      const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
      if (magnitude === 0) return v;
      return v.map(val => val / magnitude);
    };

    const normalized1 = normalize(vec1);
    const normalized2 = normalize(vec2);

    // Calculate dot product of normalized vectors (this is cosine similarity)
    let dotProduct = 0;
    for (let i = 0; i < normalized1.length; i++) {
      dotProduct += normalized1[i] * normalized2[i];
    }

    // Cosine similarity ranges from -1 to 1, normalize to 0-1
    // Since vectors are normalized, dot product IS the cosine similarity
    return (dotProduct + 1) / 2;
  }

  /**
   * Calculate Pearson correlation coefficient between two vectors
   * Measures linear relationship between features (0-1, normalized)
   * @param vec1 - First vector
   * @param vec2 - Second vector
   * @returns Correlation coefficient (0-1)
   */
  private correlationCoefficient(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length || vec1.length === 0) {
      return 0;
    }

    // Calculate means
    const mean1 = vec1.reduce((sum, val) => sum + val, 0) / vec1.length;
    const mean2 = vec2.reduce((sum, val) => sum + val, 0) / vec2.length;

    // Calculate covariance and standard deviations
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      const diff1 = vec1[i] - mean1;
      const diff2 = vec2[i] - mean2;
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    const stdDev1 = Math.sqrt(variance1 / vec1.length);
    const stdDev2 = Math.sqrt(variance2 / vec2.length);

    if (stdDev1 === 0 || stdDev2 === 0) {
      return 0;
    }

    // Pearson correlation coefficient ranges from -1 to 1
    const correlation = (covariance / vec1.length) / (stdDev1 * stdDev2);
    
    // Normalize to 0-1 range
    return (correlation + 1) / 2;
  }

  /**
   * Get configuration
   */
  getConfig(): FaceVerificationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FaceVerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.model = null;
    this.isModelLoaded = false;
    console.log("[FaceVerificationService] Cleaned up");
  }
}

