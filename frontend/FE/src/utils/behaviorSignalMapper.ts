import { EmotionType } from "@/hooks/useLiveVideoAnalysis";

export interface BehaviorSample {
  timestamp: number;
  cameraOff: boolean;
  facePresent: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Maps a sliding history of client-side face presence/position samples to behavioral presence signals.
 * Priority order:
 * 1. Camera Off
 * 2. No Face
 * 3. Intermittent Presence
 * 4. Unstable Presence
 * 5. Distracted
 * 6. Neutral
 */
export function mapBehaviorSignal(history: BehaviorSample[]): EmotionType {
  if (history.length === 0) {
    return "Camera Off";
  }

  const currentSample = history[history.length - 1];

  // 1. Camera Off: If current sample has cameraOff: true
  if (currentSample.cameraOff) {
    return "Camera Off";
  }

  // 2. No Face: If no face detected for 2+ consecutive samples
  // If there's only 1 sample and it has no face, map to "No Face" as default.
  if (!currentSample.facePresent) {
    if (history.length === 1 || !history[history.length - 2].facePresent) {
      return "No Face";
    }
  }

  // 3. Intermittent Presence: 2+ face/no-face transitions in the last 5 samples
  const recentSamplesForToggle = history.slice(-5);
  let transitions = 0;
  for (let i = 1; i < recentSamplesForToggle.length; i++) {
    if (recentSamplesForToggle[i].facePresent !== recentSamplesForToggle[i - 1].facePresent) {
      transitions++;
    }
  }
  if (transitions >= 2) {
    return "Intermittent Presence";
  }

  // 4. Unstable Presence: movement > 60px between face centers in at least 2 of the last 3 face-present samples
  // This requires 3 face-present samples to have 2 movement segments.
  const faceSamples = history.filter(s => s.facePresent && s.boundingBox).slice(-3);
  if (faceSamples.length >= 3) {
    const box0 = faceSamples[0].boundingBox!;
    const box1 = faceSamples[1].boundingBox!;
    const box2 = faceSamples[2].boundingBox!;

    const center0 = { x: box0.x + box0.width / 2, y: box0.y + box0.height / 2 };
    const center1 = { x: box1.x + box1.width / 2, y: box1.y + box1.height / 2 };
    const center2 = { x: box2.x + box2.width / 2, y: box2.y + box2.height / 2 };

    const dist1 = Math.sqrt(Math.pow(center0.x - center1.x, 2) + Math.pow(center0.y - center1.y, 2));
    const dist2 = Math.sqrt(Math.pow(center1.x - center2.x, 2) + Math.pow(center1.y - center2.y, 2));

    if (dist1 > 60 && dist2 > 60) {
      return "Unstable Presence";
    }
  }

  // 5. Distracted: face center in outer 25% margin for 2 consecutive samples
  const isStronglyOffCenter = (box: { x: number; y: number; width: number; height: number }) => {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Bounds for strongly left/right/top/bottom in a 320x240 frame (25% margins: X < 80 or > 240, Y < 60 or > 180)
    const stronglyLeft = centerX < 80;
    const stronglyRight = centerX > 240;
    const stronglyTop = centerY < 60;
    const stronglyBottom = centerY > 180;

    return stronglyLeft || stronglyRight || stronglyTop || stronglyBottom;
  };

  const recentTwo = history.slice(-2);
  if (
    recentTwo.length >= 2 &&
    recentTwo.every(s => s.facePresent && s.boundingBox && isStronglyOffCenter(s.boundingBox))
  ) {
    return "Distracted";
  }

  // 6. Otherwise: Neutral
  return "Neutral";
}
