import axios from "axios";

export interface EmotionAggregation {
  dominantEmotion: string;
  emotionCounts: Record<string, number>;
  latestEmotion: string | null;
  lastUpdatedAt: string | null;
}

export interface SessionAggregationResponse {
  sessionId: string;
  participants: Record<string, EmotionAggregation>;
  dominantEmotion: string;
  emotionCounts: Record<string, number>;
  latestEmotion: string | null;
  lastUpdatedAt: string | null;
}

const getPythonBackendUrl = () => {
  return process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || "http://localhost:8001";
};

export const LiveVideoAnalysisApiService = {
  /**
   * Fetches current emotion aggregation for a session from the Python backend.
   */
  getSessionAggregation: async (sessionId: string): Promise<SessionAggregationResponse> => {
    const backendUrl = getPythonBackendUrl();
    const { data } = await axios.get<SessionAggregationResponse>(
      `${backendUrl}/v1/live-video-analysis/${sessionId}/aggregation`,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },

  /**
   * Detects facial emotion from base64 frame.
   */
  detectEmotion: async (
    base64Frame: string,
    sessionId?: string
  ): Promise<{ emotion: string; confidence: number; all_scores?: Record<string, number> }> => {
    const backendUrl = getPythonBackendUrl();
    const { data } = await axios.post<{ emotion: string; confidence: number; all_scores?: Record<string, number> }>(
      `${backendUrl}/api/emotion/detect`,
      { frame: base64Frame, sessionId },
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
};

