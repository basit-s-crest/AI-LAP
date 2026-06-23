import { mapBehaviorSignal, BehaviorSample } from "../utils/behaviorSignalMapper";
import { EmotionType } from "../hooks/useLiveVideoAnalysis";

describe("behaviorSignalMapper", () => {
  it("should return Camera Off if history is empty", () => {
    const result = mapBehaviorSignal([], null);
    expect(result).toBe("Camera Off");
  });

  it("should return Camera Off if current sample has cameraOff: true", () => {
    const history: BehaviorSample[] = [
      { timestamp: Date.now(), cameraOff: false, facePresent: true },
      { timestamp: Date.now() + 4000, cameraOff: true, facePresent: false },
    ];
    const result = mapBehaviorSignal(history, null);
    expect(result).toBe("Camera Off");
  });

  it("should return No Face if no face is detected for 2+ consecutive samples", () => {
    const history: BehaviorSample[] = [
      { timestamp: Date.now(), cameraOff: false, facePresent: false },
      { timestamp: Date.now() + 4000, cameraOff: false, facePresent: false },
    ];
    const result = mapBehaviorSignal(history, null);
    expect(result).toBe("No Face");
  });

  it("should return Intermittent Presence if there are 2+ toggles in the last 5 samples", () => {
    const history: BehaviorSample[] = [
      { timestamp: Date.now(), cameraOff: false, facePresent: true },
      { timestamp: Date.now() + 4000, cameraOff: false, facePresent: false },
      { timestamp: Date.now() + 8000, cameraOff: false, facePresent: true },
    ];
    const result = mapBehaviorSignal(history, null);
    expect(result).toBe("Intermittent Presence");
  });

  it("should return Unstable Presence if face center movement > 60px in at least 2 of the last 3 face-present samples", () => {
    const history: BehaviorSample[] = [
      {
        timestamp: Date.now(),
        cameraOff: false,
        facePresent: true,
        boundingBox: { x: 10, y: 10, width: 50, height: 50 },
      },
      {
        timestamp: Date.now() + 4000,
        cameraOff: false,
        facePresent: true,
        boundingBox: { x: 100, y: 10, width: 50, height: 50 },
      },
      {
        timestamp: Date.now() + 8000,
        cameraOff: false,
        facePresent: true,
        boundingBox: { x: 200, y: 10, width: 50, height: 50 },
      },
    ];
    const result = mapBehaviorSignal(history, null);
    expect(result).toBe("Unstable Presence");
  });

  it("should return Distracted if face center in outer 25% margin for 2 consecutive samples", () => {
    // 320x240 frame. Margins: X < 80 or > 240, Y < 60 or > 180.
    // Center at (250, 50) is in right margin (centerX > 240) and top margin (centerY < 60)
    const history: BehaviorSample[] = [
      {
        timestamp: Date.now(),
        cameraOff: false,
        facePresent: true,
        boundingBox: { x: 230, y: 30, width: 40, height: 40 }, // center is 250, 50
      },
      {
        timestamp: Date.now() + 4000,
        cameraOff: false,
        facePresent: true,
        boundingBox: { x: 235, y: 35, width: 40, height: 40 }, // center is 255, 55
      },
    ];
    const result = mapBehaviorSignal(history, null);
    expect(result).toBe("Distracted");
  });

  describe("HSEmotion mappings with High Confidence (>= 0.50)", () => {
    it("should trust Happy/Happiness directly", () => {
      const history: BehaviorSample[] = [
        {
          timestamp: Date.now(),
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 100, y: 100, width: 50, height: 50 },
          hseEmotion: "happy",
          hseConfidence: 0.85,
        },
      ];
      expect(mapBehaviorSignal(history, null)).toBe("Happy");

      history[0].hseEmotion = "Happiness";
      expect(mapBehaviorSignal(history, null)).toBe("Happy");
    });

    it("should trust Sad/Sadness directly and map it to Sad", () => {
      const history: BehaviorSample[] = [
        {
          timestamp: Date.now(),
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 100, y: 100, width: 50, height: 50 },
          hseEmotion: "sad",
          hseConfidence: 0.60,
        },
      ];
      expect(mapBehaviorSignal(history, null)).toBe("Sad");

      history[0].hseEmotion = "Sadness";
      expect(mapBehaviorSignal(history, null)).toBe("Sad");
    });

    it("should map fear, disgust, contempt directly to Anxious", () => {
      const emotions = ["fear", "disgust", "contempt"];
      emotions.forEach((emo) => {
        const history: BehaviorSample[] = [
          {
            timestamp: Date.now(),
            cameraOff: false,
            facePresent: true,
            boundingBox: { x: 100, y: 100, width: 50, height: 50 },
            hseEmotion: emo,
            hseConfidence: 0.70,
          },
        ];
        expect(mapBehaviorSignal(history, null)).toBe("Anxious");
      });
    });

    it("should map surprise directly to Surprise", () => {
      const history: BehaviorSample[] = [
        {
          timestamp: Date.now(),
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 100, y: 100, width: 50, height: 50 },
          hseEmotion: "surprise",
          hseConfidence: 0.70,
        },
      ];
      expect(mapBehaviorSignal(history, null)).toBe("Surprise");
    });

    it("should map angry, anger directly to Angry", () => {
      ["angry", "anger"].forEach((emo) => {
        const history: BehaviorSample[] = [
          {
            timestamp: Date.now(),
            cameraOff: false,
            facePresent: true,
            boundingBox: { x: 100, y: 100, width: 50, height: 50 },
            hseEmotion: emo,
            hseConfidence: 0.70,
          },
        ];
        expect(mapBehaviorSignal(history, null)).toBe("Angry");
      });
    });

    it("should trust Neutral directly", () => {
      const history: BehaviorSample[] = [
        {
          timestamp: Date.now(),
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 100, y: 100, width: 50, height: 50 },
          hseEmotion: "neutral",
          hseConfidence: 0.90,
        },
      ];
      expect(mapBehaviorSignal(history, null)).toBe("Neutral");
    });
  });

  describe("HSEmotion mappings with Low Confidence (< 0.50)", () => {
    it("should map to Calm if movement between last two face center frames is stable (< 20px)", () => {
      const history: BehaviorSample[] = [
        {
          timestamp: Date.now(),
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 100, y: 100, width: 50, height: 50 }, // center (125, 125)
        },
        {
          timestamp: Date.now() + 4000,
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 105, y: 105, width: 50, height: 50 }, // center (130, 130), movement = sqrt(50) = 7.07px
          hseEmotion: "happy",
          hseConfidence: 0.10,
        },
      ];
      expect(mapBehaviorSignal(history, null)).toBe("Calm");
    });

    it("should map to Neutral if movement between last two face center frames is unstable (>= 20px)", () => {
      const history: BehaviorSample[] = [
        {
          timestamp: Date.now(),
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 100, y: 100, width: 50, height: 50 }, // center (125, 125)
        },
        {
          timestamp: Date.now() + 4000,
          cameraOff: false,
          facePresent: true,
          boundingBox: { x: 120, y: 120, width: 50, height: 50 }, // center (145, 145), movement = sqrt(800) = 28.28px
          hseEmotion: "happy",
          hseConfidence: 0.10,
        },
      ];
      expect(mapBehaviorSignal(history, null)).toBe("Neutral");
    });
  });
});
