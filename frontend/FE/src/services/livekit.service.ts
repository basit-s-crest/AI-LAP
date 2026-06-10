import api from "@/lib/api";
import type { LiveKitTokenResponse, LiveKitStatusResponse } from "@/types/livekit";

export const LiveKitApiService = {
  /**
   * Starts a video session (Coach only). Returns room details and token.
   */
  startSession: async (sessionId: string): Promise<LiveKitTokenResponse> => {
    const { data } = await api.post<LiveKitTokenResponse>(`/api/sessions/${sessionId}/livekit/start`);
    return data;
  },

  /**
   * Fetches a connection token for an already started video session.
   */
  getToken: async (sessionId: string): Promise<LiveKitTokenResponse> => {
    const { data } = await api.post<LiveKitTokenResponse>(`/api/sessions/${sessionId}/livekit/token`);
    return data;
  },

  /**
   * Checks the current room/video status of a session.
   */
  getStatus: async (sessionId: string): Promise<LiveKitStatusResponse> => {
    const { data } = await api.get<LiveKitStatusResponse>(`/api/sessions/${sessionId}/livekit/status`);
    return data;
  },

  /**
   * Ends a video session (Coach only).
   */
  endSession: async (sessionId: string): Promise<void> => {
    await api.post(`/api/sessions/${sessionId}/livekit/end`);
  },
};
