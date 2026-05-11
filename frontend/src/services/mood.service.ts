import api from "@/lib/api";

export type MoodValue = "GREAT" | "GOOD" | "OKAY" | "LOW" | "HARD";

export interface MoodTrendRecord {
  date: string;
  mood: MoodValue;
  score: number;
}

export interface MoodTrendResponse {
  period: number;
  totalTracked: number;
  records: MoodTrendRecord[];
  averageMood: number;
  mostFrequentMood: MoodValue | null;
  consistency: number;
}

export interface MultipleMoodTrendsResponse {
  week: MoodTrendResponse;
  month: MoodTrendResponse;
  twoMonths: MoodTrendResponse;
}

interface SubmitMoodResponse {
  message: string;
  mood: {
    id: string;
    userId: string;
    mood: MoodValue;
    date: string;
    score: number;
    createdAt: string;
    updatedAt: string;
  };
}

export const moodService = {
  async submitMood(mood: MoodValue): Promise<SubmitMoodResponse> {
    const { data } = await api.post<SubmitMoodResponse>("/api/mood", { mood });
    return data;
  },

  async getMoodTrend(days: 7 | 30 | 60): Promise<MoodTrendResponse> {
    const { data } = await api.get<{ message: string; data: MoodTrendResponse }>(
      `/api/mood/trends?days=${days}`
    );
    return data.data;
  },

  async getAllTrends(): Promise<MultipleMoodTrendsResponse> {
    const { data } = await api.get<{ message: string; data: MultipleMoodTrendsResponse }>(
      "/api/mood/all-trends"
    );
    return data.data;
  },
};