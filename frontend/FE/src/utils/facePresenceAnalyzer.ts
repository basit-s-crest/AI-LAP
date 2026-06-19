import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";

export interface FaceDetectionResult {
  facePresent: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  blendshapes?: Record<string, number>;
}

// Suppress benign internal TensorFlow Lite WASM C++ stdout/stderr log spam that displays error overlays in Next.js
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

function suppressTFLiteLogs() {
  const filterFn = (original: (...args: any[]) => void) => {
    return (...args: any[]) => {
      const msg = args.join(" ");
      if (
        msg.includes("Created TensorFlow Lite XNNPACK delegate") ||
        msg.includes("TensorFlow Lite XNNPACK delegate") ||
        msg.includes("Created TensorFlow Lite")
      ) {
        return;
      }
      original(...args);
    };
  };

  console.error = filterFn(originalConsoleError);
  console.info = filterFn(originalConsoleInfo);
  console.log = filterFn(originalConsoleLog);
  console.warn = filterFn(originalConsoleWarn);
}

if (typeof window !== "undefined") {
  suppressTFLiteLogs();
}

/**
 * FacePresenceAnalyzer
 * 
 * A utility class to lazy-load Google's MediaPipe Tasks-Vision FaceLandmarker
 * from npm packages at runtime, preventing Next.js SSR build issues.
 */
export class FacePresenceAnalyzer {
  private static faceLandmarker: FaceLandmarkerType | null = null;
  private static isLoading = false;
  private static hasFailed = false;

  /**
   * Initializes the FaceLandmarker by lazy-loading the MediaPipe library from the npm package,
   * which prevents SSR issues in Next.js.
   */
  public static async init(): Promise<boolean> {
    if (this.faceLandmarker) return true;
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

      console.log("[FacePresenceAnalyzer] Creating FaceLandmarker instance...");
      this.faceLandmarker = await mp.FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "IMAGE",
        numFaces: 1
      });

      console.log("[FacePresenceAnalyzer] MediaPipe FaceLandmarker initialized successfully.");
      this.isLoading = false;
      return true;
    } catch (err) {
      console.error("[FacePresenceAnalyzer] Failed to initialize MediaPipe FaceLandmarker:", err);
      this.hasFailed = true;
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Analyzes an HTML element (image, video, canvas) for face presence and returns the bounding box and blendshapes.
   */
  public static async isFacePresent(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<FaceDetectionResult> {
    if (!this.faceLandmarker) {
      const initialized = await this.init();
      if (!initialized) {
        throw new Error("FaceLandmarker could not be initialized");
      }
    }

    const landmarker = this.faceLandmarker!;
    const results = landmarker.detect(source);
    
    const hasFace = !!(results && results.faceLandmarks && results.faceLandmarks.length > 0);

    if (hasFace) {
      // 1. Calculate bounding box from face landmarks (normalized coordinates between 0 and 1)
      const landmarks = results.faceLandmarks[0];
      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;
      for (const lm of landmarks) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
      }

      // Resolve source dimensions
      let srcWidth = 320;
      let srcHeight = 240;
      if (source instanceof HTMLImageElement) {
        srcWidth = source.naturalWidth || source.width || 320;
        srcHeight = source.naturalHeight || source.height || 240;
      } else if (source instanceof HTMLVideoElement) {
        srcWidth = source.videoWidth || 320;
        srcHeight = source.videoHeight || 240;
      } else if (source instanceof HTMLCanvasElement) {
        srcWidth = source.width || 320;
        srcHeight = source.height || 240;
      }

      const boundingBox = {
        x: minX * srcWidth,
        y: minY * srcHeight,
        width: (maxX - minX) * srcWidth,
        height: (maxY - minY) * srcHeight
      };

      // 2. Extract blendshapes into a record map
      const blendshapes: Record<string, number> = {};
      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const categories = results.faceBlendshapes[0].categories;
        for (const cat of categories) {
          blendshapes[cat.categoryName] = cat.score;
        }
      }

      return {
        facePresent: true,
        boundingBox,
        blendshapes
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
    return !!this.faceLandmarker;
  }

  /**
   * Helper to inspect failure state.
   */
  public static failedToLoad(): boolean {
    return this.hasFailed;
  }
}
