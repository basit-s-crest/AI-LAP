/**
 * VideoFrameSampler
 * 
 * Captures low-frequency, low-resolution JPEG frames from a MediaStreamTrack (video track)
 * using an offscreen canvas, without storing or persisting any data.
 */
export class VideoFrameSampler {
  private track: MediaStreamTrack;
  private intervalMs: number;
  private width: number;
  private height: number;
  private quality: number;
  
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private activeInterval: NodeJS.Timeout | null = null;
  private onFrameCallback: ((base64Frame: string) => void) | null = null;
  private onTrackInactiveCallback: (() => void) | null = null;

  constructor(
    track: MediaStreamTrack,
    options: {
      intervalMs?: number;
      width?: number;
      height?: number;
      quality?: number;
      onTrackInactive?: () => void;
    } = {}
  ) {
    this.track = track;
    this.intervalMs = options.intervalMs || 4000; // default 4 seconds
    this.width = options.width || 320;           // low-resolution width
    this.height = options.height || 240;         // low-resolution height
    this.quality = options.quality || 0.5;       // JPEG compression quality
    this.onTrackInactiveCallback = options.onTrackInactive || null;
  }

  /**
   * Starts the periodic frame sampling.
   * @param onFrame Callback invoked with the base64 JPEG data URL on each sample.
   */
  public start(onFrame: (base64Frame: string) => void): void {
    if (this.activeInterval) {
      this.stop();
    }

    console.log("[VideoFrameSampler] Starting sampler. Interval (ms):", this.intervalMs);
    this.onFrameCallback = onFrame;

    // Create a hidden video element to feed the track
    this.videoEl = document.createElement("video");
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.muted = true;
    this.videoEl.style.display = "none";

    // Bind track to video element via MediaStream
    const mediaStream = new MediaStream([this.track]);
    this.videoEl.srcObject = mediaStream;

    // Create offscreen canvas for rendering
    this.canvasEl = document.createElement("canvas");
    this.canvasEl.width = this.width;
    this.canvasEl.height = this.height;

    // Start playback and interval
    this.videoEl.play()
      .then(() => {
        console.log("[VideoFrameSampler] Video track playback started successfully.");
        this.scheduleNextSample();
      })
      .catch((err) => {
        if (err && err.name === "AbortError") {
          console.log("[VideoFrameSampler] Play request was interrupted by a call to pause (normal teardown).");
        } else {
          console.error("[VideoFrameSampler] Failed to play video track:", err);
        }
      });
  }

  /**
   * Schedules the next frame sample.
   */
  private scheduleNextSample(): void {
    this.activeInterval = setTimeout(() => {
      this.captureFrame();
      if (this.activeInterval) {
        this.scheduleNextSample();
      }
    }, this.intervalMs);
  }

  /**
   * Captures a single frame, draws to offscreen canvas, and triggers callback.
   */
  private captureFrame(): void {
    if (!this.track || this.track.readyState !== "live") {
      console.log("[VideoFrameSampler] Video track has ended or is unavailable. Stopping sampler.");
      if (this.onTrackInactiveCallback) {
        this.onTrackInactiveCallback();
      }
      this.stop();
      return;
    }

    // Skip capture if track is disabled or muted (camera off / privacy toggle)
    if (!this.track.enabled || this.track.muted) {
      console.log("[VideoFrameSampler] Track is disabled or muted. Skipping frame capture.");
      if (this.onTrackInactiveCallback) {
        this.onTrackInactiveCallback();
      }
      return;
    }

    if (!this.videoEl || !this.canvasEl || !this.onFrameCallback) {
      return;
    }

    // Double-check video dimensions are ready
    if (this.videoEl.videoWidth === 0 || this.videoEl.videoHeight === 0) {
      console.log("[VideoFrameSampler] Video dimensions not ready yet. Skipping sample.");
      return;
    }

    const ctx = this.canvasEl.getContext("2d");
    if (!ctx) {
      return;
    }

    try {
      // Draw video frame to the configured canvas resolution
      ctx.drawImage(this.videoEl, 0, 0, this.width, this.height);
      
      // Convert to low-resolution, compressed JPEG
      const base64Data = this.canvasEl.toDataURL("image/jpeg", this.quality);
      
      // Emit the frame
      this.onFrameCallback(base64Data);
    } catch (err) {
      console.error("[VideoFrameSampler] Error during frame capture:", err);
    }
  }

  /**
   * Stops the sampler and cleans up all DOM/media references.
   */
  public stop(): void {
    console.log("[VideoFrameSampler] Stopping sampler and cleaning up resources.");
    
    if (this.activeInterval) {
      clearTimeout(this.activeInterval);
      this.activeInterval = null;
    }

    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
      this.videoEl.remove();
      this.videoEl = null;
    }

    if (this.canvasEl) {
      this.canvasEl.remove();
      this.canvasEl = null;
    }

    this.onFrameCallback = null;
  }
}
