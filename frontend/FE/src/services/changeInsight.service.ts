import api from "@/lib/api";
import type { ChangeInsightDTO } from "@/components/session/ChangeInsightsPanel";

export const changeInsightService = {
  async getChangeInsights(memberId?: string): Promise<ChangeInsightDTO[]> {
    const params = memberId ? { memberId } : {};
    const { data } = await api.get<ChangeInsightDTO[]>("/api/change-insights", { params });
    return data;
  },

  async compare(sessionId: string): Promise<{
    status: string;
    message?: string;
    insight?: ChangeInsightDTO;
  }> {
    const { data } = await api.post<{
      status: string;
      message?: string;
      insight?: ChangeInsightDTO;
    }>("/api/change-insights/compare", { sessionId });
    return data;
  },
};
export type { ChangeInsightDTO };
