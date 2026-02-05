/**
 * Global Model Service (Singleton)
 *
 * Loads and caches AI models (BlazeFace + FaceMesh) for reuse across components.
 * Face verification is done on the backend (DeepFace ArcFace); no client-side face recognition model.
 */

import type * as blazeface from "@tensorflow-models/blazeface";
import type { FaceMesh } from "@mediapipe/face_mesh";

interface ModelServiceState {
  blazefaceModel: blazeface.BlazeFaceModel | null;
  faceMesh: FaceMesh | null;
  isBlazeFaceLoading: boolean;
  isFaceMeshLoading: boolean;
  isBlazeFaceLoaded: boolean;
  isFaceMeshLoaded: boolean;
  error: string | null;
}

class ModelService {
  private static instance: ModelService;
  private state: ModelServiceState = {
    blazefaceModel: null,
    faceMesh: null,
    isBlazeFaceLoading: false,
    isFaceMeshLoading: false,
    isBlazeFaceLoaded: false,
    isFaceMeshLoaded: false,
    error: null,
  };

  private blazeFaceLoadPromise: Promise<blazeface.BlazeFaceModel | null> | null = null;
  private faceMeshLoadPromise: Promise<FaceMesh | null> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  /**
   * Load BlazeFace model for face detection
   */
  async loadBlazeFace(): Promise<blazeface.BlazeFaceModel | null> {
    // Return cached model if already loaded
    if (this.state.blazefaceModel) {
      return this.state.blazefaceModel;
    }

    // Return existing promise if loading
    if (this.blazeFaceLoadPromise) {
      return this.blazeFaceLoadPromise;
    }

    // Start loading
    this.state.isBlazeFaceLoading = true;
    this.state.error = null;

    this.blazeFaceLoadPromise = (async () => {
      try {
        console.log("[ModelService] Loading BlazeFace model...");

        // Initialize TensorFlow.js
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();

        // Set backend (prefer WebGL)
        try {
          await tf.setBackend("webgl");
          await tf.ready();
        } catch (e) {
          console.warn("[ModelService] WebGL backend not available, using CPU");
          await tf.setBackend("cpu");
          await tf.ready();
        }

        // Load BlazeFace model
        const blazeface = await import("@tensorflow-models/blazeface");
        const model = await blazeface.load();

        this.state.blazefaceModel = model;
        this.state.isBlazeFaceLoaded = true;
        this.state.isBlazeFaceLoading = false;
        console.log("[ModelService] ✅ BlazeFace model loaded successfully");

        return model;
      } catch (error) {
        console.error("[ModelService] Failed to load BlazeFace:", error);
        this.state.error = `BlazeFace loading failed: ${(error as Error).message}`;
        this.state.isBlazeFaceLoading = false;
        return null;
      }
    })();

    return this.blazeFaceLoadPromise;
  }

  /**
   * Load FaceMesh model for gaze detection
   */
  async loadFaceMesh(): Promise<FaceMesh | null> {
    // Return cached model if already loaded
    if (this.state.faceMesh) {
      return this.state.faceMesh;
    }

    // Return existing promise if loading
    if (this.faceMeshLoadPromise) {
      return this.faceMeshLoadPromise;
    }

    // Start loading
    this.state.isFaceMeshLoading = true;
    this.state.error = null;

    this.faceMeshLoadPromise = (async () => {
      try {
        console.log("[ModelService] Loading FaceMesh model...");

        // Set up locateFile before importing
        if (typeof window !== 'undefined') {
          (window as any).createMediapipeSolutionsPackedAssets = {
            locateFile: (file: string) => `/mediapipe/face_mesh/${file}`
          };
          (window as any).Module = (window as any).Module || {};
          (window as any).Module.locateFile = (file: string) => `/mediapipe/face_mesh/${file}`;
        }

        const FaceMeshModule = await import('@mediapipe/face_mesh');
        const faceMesh = new FaceMeshModule.FaceMesh({
          locateFile: (file: string) => {
            const url = `/mediapipe/face_mesh/${file}`;
            console.log(`[ModelService] Loading asset: ${url}`);
            return url;
          }
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        await faceMesh.initialize();
        this.state.faceMesh = faceMesh;
        this.state.isFaceMeshLoaded = true;
        this.state.isFaceMeshLoading = false;
        console.log("[ModelService] ✅ FaceMesh model loaded successfully");

        return faceMesh;
      } catch (error) {
        console.warn("[ModelService] FaceMesh failed to load (non-critical):", error);
        // FaceMesh is optional - continue without it
        this.state.isFaceMeshLoading = false;
        return null;
      }
    })();

    return this.faceMeshLoadPromise;
  }

  /**
   * Load all models in parallel (BlazeFace + FaceMesh only; face verification is backend DeepFace ArcFace)
   */
  async loadAllModels(): Promise<{
    blazeface: blazeface.BlazeFaceModel | null;
    faceMesh: FaceMesh | null;
  }> {
    console.log("[ModelService] Loading all models in parallel (BlazeFace + FaceMesh)...");
    const [blazefaceModel, faceMesh] = await Promise.all([
      this.loadBlazeFace(),
      this.loadFaceMesh(),
    ]);

    return {
      blazeface: blazefaceModel,
      faceMesh,
    };
  }

  /**
   * Get BlazeFace model (returns null if not loaded)
   */
  getBlazeFace(): blazeface.BlazeFaceModel | null {
    return this.state.blazefaceModel;
  }

  /**
   * Get FaceMesh model (returns null if not loaded)
   */
  getFaceMesh(): FaceMesh | null {
    return this.state.faceMesh;
  }

  /**
   * Check if BlazeFace is loaded
   */
  isBlazeFaceLoaded(): boolean {
    return this.state.isBlazeFaceLoaded;
  }

  /**
   * Check if FaceMesh is loaded
   */
  isFaceMeshLoaded(): boolean {
    return this.state.isFaceMeshLoaded;
  }

  /**
   * Check if all models are loaded
   */
  areAllModelsLoaded(): boolean {
    return this.state.isBlazeFaceLoaded && this.state.isFaceMeshLoaded;
  }

  /**
   * Check if models are currently loading
   */
  areModelsLoading(): boolean {
    return this.state.isBlazeFaceLoading || this.state.isFaceMeshLoading;
  }

  /**
   * Get loading state
   */
  getState(): ModelServiceState {
    return { ...this.state };
  }

  /**
   * Cleanup models (call when done)
   */
  cleanup(): void {
    if (this.state.faceMesh) {
      this.state.faceMesh = null;
    }
    this.state.blazefaceModel = null;
    this.state.isBlazeFaceLoaded = false;
    this.state.isFaceMeshLoaded = false;
    this.blazeFaceLoadPromise = null;
    this.faceMeshLoadPromise = null;
    console.log("[ModelService] Models cleaned up");
  }
}

// Export singleton instance
export const modelService = ModelService.getInstance();
export default modelService;

