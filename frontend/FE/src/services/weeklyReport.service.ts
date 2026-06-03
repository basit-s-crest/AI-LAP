import api from "@/lib/api";

export interface WeeklyReportData {
  weekStartDate: string;
  weekEndDate: string;
  summary: {
    totalMembers: number;
    activeMembers: number;
    newMembers: number;
    engagementRate: number;
    sessionsCompleted: number;
    avgSessionRating: number | null;
    crisisAlerts: number;
  };
  mentalHealth: {
    avgPhqScore: number | null;
    avgGadScore: number | null;
    moodEntries: number;
    moodDistribution: {
      GREAT: number;
      GOOD: number;
      OKAY: number;
      LOW: number;
      HARD: number;
    };
  };
  community: {
    groupPosts: number;
    groupMembers: number;
    coachMessages: number;
  };
  coaches: {
    topActiveCoaches: Array<{
      id: string;
      name: string;
      speciality: string | null;
      messageCount: number;
    }>;
  };
}

export interface WeeklyReport {
  id: string;
  organizationId: string;
  weekStartDate: string;
  weekEndDate: string;
  reportData: WeeklyReportData;
  generatedAt: string;
  createdAt: string;
}

export interface AvailableWeek {
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: string;
}

export const weeklyReportService = {
  getWeeklyReport: async (week?: string): Promise<WeeklyReport> => {
    const params = week ? { week } : {};
    const { data } = await api.get("/api/org/weekly-report", { params });
    return data;
  },

  getAvailableWeeks: async (): Promise<AvailableWeek[]> => {
    const { data } = await api.get("/api/org/weekly-report/weeks");
    return data;
  },

  regenerateReport: async (week: string): Promise<WeeklyReport> => {
    const { data } = await api.post("/api/org/weekly-report/regenerate", null, {
      params: { week },
    });
    return data;
  },
};
