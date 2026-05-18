import api from "@/lib/api";
import type { CoachPublicDTO } from "@/types/coach";

/** Backend returns isActive; we expose it as onDemand on the DTO. */
function normalise(raw: CoachPublicDTO & { isActive?: boolean }): CoachPublicDTO {
  return { ...raw, onDemand: raw.onDemand ?? raw.isActive ?? false };
}

export const coachService = {
  async list(): Promise<CoachPublicDTO[]> {
    const response = await api.get<{ coaches: CoachPublicDTO[] }>("/api/coach/list");
    return response.data.coaches.map(normalise);
  },

  async getById(coachId: string): Promise<CoachPublicDTO> {
    const response = await api.get<{ coach: CoachPublicDTO }>(`/api/coach/${encodeURIComponent(coachId)}`);
    return normalise(response.data.coach);
  },
};
