import api from "@/lib/api";
import type { CoachPublicDTO } from "@/types/coach";

export const coachService = {
  async list(): Promise<CoachPublicDTO[]> {
    const response = await api.get<{ coaches: CoachPublicDTO[] }>("/api/coach/list");
    return response.data.coaches;
  },

  async getById(coachId: string): Promise<CoachPublicDTO> {
    const response = await api.get<{ coach: CoachPublicDTO }>(`/api/coach/${encodeURIComponent(coachId)}`);
    return response.data.coach;
  },
};
