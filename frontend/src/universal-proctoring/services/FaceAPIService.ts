/**
 * FaceAPIService - face-api.js 128-D face recognition for face mismatch detection ONLY.
 *
 * PURPOSE: Provides identity-aware face descriptors for face mismatch detection.
 * SCOPE: ONLY used for face mismatch (comparing if person changed).
 * NOT USED FOR: Face detection, multi-face, gaze, or other proctoring features.
 *
 * Why separate from ModelService:
 * - ModelService handles BlazeFace for general face detection
 * - This service handles face-api.js ONLY for identity matching
 */

import * as faceapi from "face-api.js";

interface FaceAPIConfig {
  modelPath: string;
  minConfidence?: number;
}

interface FaceDescriptorResult {
  descriptor: Float32Array;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class FaceAPIService {
  private modelsLoaded = false;
  private config: FaceAPIConfig;
  private loadingPromise: Promise<void> | null = null;

  constructor(config: FaceAPIConfig = { modelPath: "/models/face-api" }) {
    this.config = {
      minConfidence: 0.7,
      ...config,
    };
  }

  /**
   * Load face-api.js models from public directory.
   * Models are loaded once and cached.
   */
  async loadModels(): Promise<void> {
    if (this.modelsLoaded) {
      console.log("[FaceAPIService] ✅ Models already loaded");
      return;
    }
    if (this.loadingPromise) {
      console.log("[FaceAPIService] ⏳ Models currently loading, waiting...");
      return this.loadingPromise;
    }
    this.loadingPromise = this._loadModels();
    await this.loadingPromise;
    this.loadingPromise = null;
  }

  private async _loadModels(): Promise<void> {
    try {
      console.log("[FaceAPIService] 📦 Loading face-api.js models from:", this.config.modelPath);

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.config.modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.config.modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.config.modelPath),
      ]);

      this.modelsLoaded = true;
      console.log("[FaceAPIService] ✅ All face-api.js models loaded successfully");
      console.log("[FaceAPIService] 📊 Models ready for 128-D face recognition");
    } catch (error) {
      this.modelsLoaded = false;
      console.error("[FaceAPIService] ❌ Failed to load face-api.js models:", error);
      console.error("[FaceAPIService] 💡 Ensure model files are in:", this.config.modelPath);
      throw new Error(
        `Failed to load face-api.js models from ${this.config.modelPath}: ${error}`
      );
    }
  }

  /**
   * Extract 128-D face descriptor from image.
   * Used for face mismatch detection only.
   */
  async getFaceDescriptor(
    imageElement: HTMLImageElement | HTMLCanvasElement
  ): Promise<Float32Array | null> {
    if (!this.modelsLoaded) {
      console.warn("[FaceAPIService] ⚠️ Models not loaded, loading now...");
      await this.loadModels();
    }

    try {
      const options = new faceapi.SsdMobilenetv1Options({
        minConfidence: this.config.minConfidence ?? 0.7,
      });

      const detection = await faceapi
        .detectSingleFace(imageElement, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.warn("[FaceAPIService] ⚠️ No face detected in image");
        return null;
      }

      const descriptor = detection.descriptor;

      console.log("[FaceAPIService] ✅ 128-D face descriptor extracted:", {
        dimensions: descriptor.length,
        type: descriptor.constructor.name,
        confidence: detection.detection.score?.toFixed(3) ?? "N/A",
        sampleValues: Array.from(descriptor.slice(0, 5)).map((v) => v.toFixed(3)),
      });

      return descriptor;
    } catch (error) {
      console.error("[FaceAPIService] ❌ Error extracting face descriptor:", error);
      return null;
    }
  }

  /**
   * Extract descriptor with additional metadata.
   */
  async getFaceDescriptorWithMetadata(
    imageElement: HTMLImageElement | HTMLCanvasElement
  ): Promise<FaceDescriptorResult | null> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }

    try {
      const options = new faceapi.SsdMobilenetv1Options({
        minConfidence: this.config.minConfidence ?? 0.7,
      });

      const detection = await faceapi
        .detectSingleFace(imageElement, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      const box = detection.detection.box;
      return {
        descriptor: detection.descriptor,
        confidence: detection.detection.score ?? 0,
        boundingBox: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
      };
    } catch (error) {
      console.error("[FaceAPIService] ❌ Error extracting descriptor with metadata:", error);
      return null;
    }
  }

  /**
   * Extract descriptor from base64 image string.
   */
  async getFaceDescriptorFromBase64(base64Image: string): Promise<Float32Array | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const descriptor = await this.getFaceDescriptor(img);
          resolve(descriptor);
        } catch (error) {
          console.error("[FaceAPIService] ❌ Error processing base64 image:", error);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.error("[FaceAPIService] ❌ Failed to load image from base64");
        resolve(null);
      };
      img.src = base64Image;
    });
  }

  isReady(): boolean {
    return this.modelsLoaded;
  }

  getConfig(): FaceAPIConfig {
    return { ...this.config };
  }
}

export const faceAPIService = new FaceAPIService();
