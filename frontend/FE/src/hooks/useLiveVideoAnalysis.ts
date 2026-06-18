import { useEffect, useRef, useState, useCallback } from "react";
import { VideoFrameSampler } from "@/utils/videoFrameSampler";
import { FacePresenceAnalyzer } from "@/utils/facePresenceAnalyzer";
import { mapBehaviorSignal, BehaviorSample } from "@/utils/behaviorSignalMapper";

export type EmotionType = 
  | "Calm" 
  | "Neutral" 
  | "Anxious" 
  | "No Face" 
  | "Camera Off"
  | "Intermittent Presence"
  | "Unstable Presence"
  | "Distracted";

export interface EmotionSignal {
  type: "emotion_signal";
  sessionId: string;
  participantId: string;
  timestamp: string;
  dominantEmotion: EmotionType;
  confidence: number;
  source: "local_mock" | "mediapipe";
}

const CONFIDENCE_MAP: Record<EmotionType, number> = {
  "Calm": 0.82,
  "Neutral": 0.75,
  "Anxious": 0.79,
  "No Face": 0.95,
  "Camera Off": 1.0,
  "Intermittent Presence": 0.85,
  "Unstable Presence": 0.80,
  "Distracted": 0.88,
};

interface UseLiveVideoAnalysisProps {
  videoTrack: MediaStreamTrack | null;
  isEnabled: boolean; // Managed by feature flag and user consent
  sessionId: string;
  participantId: string;
  onFrameCaptured?: (base64Frame: string) => void;
}

export function useLiveVideoAnalysis({
  videoTrack,
  isEnabled,
  sessionId,
  participantId,
  onFrameCaptured,
}: UseLiveVideoAnalysisProps) {
  const [isSampling, setIsSampling] = useState(false);
  const [latestEmotion, setLatestEmotion] = useState<EmotionSignal | null>(null);
  const [isManualActive, setIsManualActive] = useState(true);
  const [mediaPipeReady, setMediaPipeReady] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [isTrackActive, setIsTrackActive] = useState(false);
  
  const samplerRef = useRef<VideoFrameSampler | null>(null);
  const historyRef = useRef<BehaviorSample[]>([]);

  const isTrackInactive = useCallback((track: MediaStreamTrack | null) => {
    return !track || !track.enabled || track.muted || track.readyState !== "live";
  }, []);

  const pushHistorySample = useCallback((sample: Omit<BehaviorSample, "timestamp">) => {
    const fullSample: BehaviorSample = {
      ...sample,
      timestamp: Date.now(),
    };
    historyRef.current.push(fullSample);
    if (historyRef.current.length > 10) {
      historyRef.current.shift();
    }
    return historyRef.current;
  }, []);

  const setCameraOffSignal = useCallback((reason: string) => {
    console.log(`[useLiveVideoAnalysis] Setting Camera Off signal. Reason: ${reason}`);
    
    // Clear history on camera off to prevent carrying over stale movements
    historyRef.current = [];

    const history = pushHistorySample({ cameraOff: true, facePresent: false });
    const emotion = mapBehaviorSignal(history);

    setLatestEmotion({
      type: "emotion_signal",
      sessionId,
      participantId,
      timestamp: new Date().toISOString(),
      dominantEmotion: emotion,
      confidence: CONFIDENCE_MAP[emotion],
      source: mediaPipeReady ? "mediapipe" : "local_mock",
    });
  }, [sessionId, participantId, mediaPipeReady, pushHistorySample]);

  // Dynamically listen to track events to keep isTrackActive state updated in real-time
  useEffect(() => {
    if (!videoTrack) {
      setIsTrackActive(false);
      return;
    }

    const updateTrackState = () => {
      const active = !isTrackInactive(videoTrack);
      setIsTrackActive(active);
    };

    updateTrackState();

    videoTrack.addEventListener("mute", updateTrackState);
    videoTrack.addEventListener("unmute", updateTrackState);
    videoTrack.addEventListener("ended", updateTrackState);

    return () => {
      videoTrack.removeEventListener("mute", updateTrackState);
      videoTrack.removeEventListener("unmute", updateTrackState);
      videoTrack.removeEventListener("ended", updateTrackState);
    };
  }, [videoTrack, isTrackInactive]);

  const startAnalysis = useCallback(() => {
    setIsManualActive(true);
  }, []);

  const stopAnalysis = useCallback(() => {
    setIsManualActive(false);
  }, []);

  const isAnalysisActive = isEnabled && isManualActive;

  useEffect(() => {
    // Teardown previous sampler if any parameter changes
    if (samplerRef.current) {
      samplerRef.current.stop();
      samplerRef.current = null;
      setIsSampling(false);
    }

    if (!isAnalysisActive) {
      setLatestEmotion(null);
      return;
    }

    // Direct synchronous check to prevent race conditions when videoTrack changes to null/inactive
    // before the async React state updates for isTrackActive have been flushed/applied.
    if (!videoTrack || isTrackInactive(videoTrack) || !isTrackActive) {
      setCameraOffSignal("track is inactive");
      return;
    }

    console.log("[useLiveVideoAnalysis] Initializing Live Video Analysis Sampler.");

    // Create a new frame sampler targeting the remote member video track
    const sampler = new VideoFrameSampler(videoTrack!, {
      intervalMs: 4000, // sample every 4 seconds
      width: 320,       // low resolution
      height: 240,
      quality: 0.5,     // low quality compression
      onTrackInactive: () => {
        setCameraOffSignal("sampler callback inactive");
        if (samplerRef.current) {
          samplerRef.current.stop();
          samplerRef.current = null;
          setIsSampling(false);
        }
      }
    });
    
    samplerRef.current = sampler;
    setIsSampling(true);

    // Lazy load FaceDetector when sampling starts (as consent is enabled)
    FacePresenceAnalyzer.init()
      .then((success) => {
        setMediaPipeReady(success);
        setUsingFallback(!success);
      })
      .catch((err) => {
        console.warn("[useLiveVideoAnalysis] Prefetching MediaPipe failed:", err);
        setMediaPipeReady(false);
        setUsingFallback(true);
      });

    sampler.start((base64Frame) => {
      // Double check track status during active sampler loop
      if (isTrackInactive(videoTrack)) {
        setCameraOffSignal("sampler loop checked inactive track");
        return;
      }

      // Load base64Frame into an Image element for MediaPipe analysis
      const img = new Image();
      img.onload = async () => {
        try {
          // Verify if track is still enabled during load
          if (isTrackInactive(videoTrack)) {
            setCameraOffSignal("sampler load loaded inactive track");
            return;
          }

          const isMediaPipeAvailable = await FacePresenceAnalyzer.init();
          if (isMediaPipeAvailable) {
            const result = await FacePresenceAnalyzer.isFacePresent(img);
            
            // Push sample and map behavior
            const history = pushHistorySample({
              cameraOff: false,
              facePresent: result.facePresent,
              boundingBox: result.boundingBox,
            });
            const emotion = mapBehaviorSignal(history);

            setLatestEmotion({
              type: "emotion_signal",
              sessionId,
              participantId,
              timestamp: new Date().toISOString(),
              dominantEmotion: emotion,
              confidence: CONFIDENCE_MAP[emotion],
              source: "local_mock",
            });
          } else {
            // MediaPipe not available, trigger mock fallback
            triggerMockFallback();
          }
        } catch (err) {
          console.warn("[useLiveVideoAnalysis] MediaPipe face detection failed, using mock fallback:", err);
          triggerMockFallback();
        }
      };
      
      img.onerror = () => {
        console.warn("[useLiveVideoAnalysis] Failed to load sampled frame image, using mock fallback.");
        triggerMockFallback();
      };
      
      img.src = base64Frame;

      function triggerMockFallback() {
        const rand = Math.random();
        let mockEmotion: EmotionType = "Neutral";
        if (rand < 0.55) {
          mockEmotion = "Neutral";
        } else if (rand < 0.90) {
          mockEmotion = "Calm";
        } else if (rand < 0.98) {
          mockEmotion = "Anxious";
        } else {
          mockEmotion = "No Face";
        }

        // Push mock fallback to history to keep it synced
        pushHistorySample({
          cameraOff: false,
          facePresent: mockEmotion !== "No Face",
        });

        setLatestEmotion({
          type: "emotion_signal",
          sessionId,
          participantId,
          timestamp: new Date().toISOString(),
          dominantEmotion: mockEmotion,
          confidence: CONFIDENCE_MAP[mockEmotion],
          source: "local_mock",
        });
      }

      // Call parent hook callback if provided (e.g. for future backend uploads)
      if (onFrameCaptured) {
        onFrameCaptured(base64Frame);
      }
    });

    // Teardown on clean-up / unmount
    return () => {
      if (samplerRef.current) {
        samplerRef.current.stop();
        samplerRef.current = null;
        setIsSampling(false);
      }
    };
  }, [videoTrack, isAnalysisActive, isTrackActive, sessionId, participantId, onFrameCaptured, setCameraOffSignal, isTrackInactive, pushHistorySample]);

  return {
    latestEmotion,
    isSampling,
    startAnalysis,
    stopAnalysis,
    mediaPipeReady,
    usingFallback,
  };
}
