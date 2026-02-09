/**
 * Face API Service
 * 
 * Client-side face recognition service using @vladmandic/face-api.
 * Uses CDN models (no local files needed).
 * Provides face embedding extraction and comparison functionality.
 * 
 * 100% client-side - NO backend calls
 * Uses dynamic imports to avoid SSR issues
 */

class FaceAPIService {
  private modelsLoaded = false;
  private loadingPromise: Promise<void> | null = null;
  private faceapi: any = null; // Will be loaded dynamically
  private modelPath = 'https://vladmandic.github.io/face-api/model'; // CDN

  /**
   * Ensure we're in browser environment
   */
  private ensureBrowser(): void {
    if (typeof window === 'undefined') {
      throw new Error('FaceAPIService can only be used in browser environment');
    }
  }

  /**
   * Dynamically load face-api library (client-side only)
   */
  private async loadFaceAPI(): Promise<any> {
    if (this.faceapi) {
      return this.faceapi;
    }

    this.ensureBrowser();

    // Dynamic import to avoid SSR issues
    const faceapiModule = await import('@vladmandic/face-api');
    this.faceapi = faceapiModule;
    return this.faceapi;
  }

  async initialize(): Promise<void> {
    this.ensureBrowser();

    if (this.modelsLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;
    
    this.loadingPromise = this._loadModels();
    return this.loadingPromise;
  }

  private async _loadModels(): Promise<void> {
    try {
      // Load face-api library first
      const faceapi = await this.loadFaceAPI();

      console.log('[FaceAPIService] 📦 Loading models from CDN:', this.modelPath);
      
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath)
      ]);

      this.modelsLoaded = true;
      console.log('[FaceAPIService] ✅ All models loaded successfully');
    } catch (error) {
      console.error('[FaceAPIService] ❌ Model loading failed:', error);
      this.loadingPromise = null;
      throw error;
    }
  }

  async extractEmbedding(imageData: string): Promise<Float32Array | null> {
    this.ensureBrowser();
    await this.initialize();

    try {
      const faceapi = await this.loadFaceAPI();

      // face-api's fetchImage can handle data URLs, URLs, or HTMLImageElement
      const img = await faceapi.fetchImage(imageData);
      
      // Use SSD MobileNet for face detection (more accurate than TinyFaceDetector)
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.warn('[FaceAPIService] ⚠️ No face detected');
        return null;
      }

      console.log('[FaceAPIService] ✅ Embedding extracted: 128-D');
      return detection.descriptor;
    } catch (error) {
      console.error('[FaceAPIService] ❌ Extraction failed:', error);
      return null;
    }
  }

  compareEmbeddings(emb1: Float32Array, emb2: Float32Array): number {
    this.ensureBrowser();

    // Load face-api if not already loaded
    if (!this.faceapi) {
      throw new Error('FaceAPIService not initialized. Call initialize() first.');
    }

    const distance = this.faceapi.euclideanDistance(emb1, emb2);
    console.log('[FaceAPIService] 📊 Distance:', distance.toFixed(3));
    return distance;
  }

  isReady(): boolean {
    return this.modelsLoaded && typeof window !== 'undefined';
  }
}

export const faceAPIService = new FaceAPIService();
