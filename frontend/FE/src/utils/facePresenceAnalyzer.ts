import type { FaceDetector as FaceDetectorType } from "@mediapipe/tasks-vision";

export interface FaceDetectionResult {
  facePresent: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * FacePresenceAnalyzer
 * 
 * A utility class to lazy-load Google's MediaPipe Tasks-Vision FaceDetector
 * from npm packages at runtime, preventing Next.js SSR build issues.
 */
export class FacePresenceAnalyzer {
  private static faceDetector: FaceDetectorType | null = null;
  private static isLoading = false;
  private static hasFailed = false;

  /**
   * Initializes the FaceDetector by lazy-loading the MediaPipe library from the npm package,
   * which prevents SSR issues in Next.js.
   */
  public static async init(): Promise<boolean> {
    if (this.faceDetector) return true;
    if (this.isLoading) return false;
    if (this.hasFailed) return false;

    this.isLoading = true;
    try {
      console.log("[FacePresenceAnalyzer] Dynamically importing @mediapipe/tasks-vision package...");
      const mp = await import("@mediapipe/tasks-vision");
      
      console.log("[FacePresenceAnalyzer] Resolving FilesetResolver for WASM tasks...");
      const filesetResolver = await mp.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
      );

      console.log("[FacePresenceAnalyzer] Creating FaceDetector instance...");
      this.faceDetector = await mp.FaceDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "IMAGE"
      });

      console.log("[FacePresenceAnalyzer] MediaPipe FaceDetector initialized successfully.");
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error("[FacePresenceAnalyzer] Failed to initialize MediaPipe FaceDetector:", err);
      this.hasFailed = true;
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Analyzes an HTML element (image, video, canvas) for face presence and returns the bounding box.
   */
  public static async isFacePresent(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<FaceDetectionResult> {
    if (!this.faceDetector) {
      const initialized = await this.init();
      if (!initialized) {
        throw new Error("FaceDetector could not be initialized");
      }
    }

    const detector = this.faceDetector!;
    const results = detector.detect(source);
    const hasFace = !!(results && results.detections && results.detections.length > 0);

    if (hasFace) {
      const box = results.detections[0].boundingBox;
      return {
        facePresent: true,
        boundingBox: box ? {
          x: box.originX,
          y: box.originY,
          width: box.width,
          height: box.height
        } : undefined
      };
    }

    return {
      facePresent: false
    };
  }

  /**
   * Helper to inspect current state.
   */
  public static isReady(): boolean {
    return !!this.faceDetector;
  }

  /**
   * Helper to inspect failure state.
   */
  public static failedToLoad(): boolean {
    return this.hasFailed;
  }
}
