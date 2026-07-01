"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface OrgMoodRow {
  key: string;
  label: string;
  percent: number;
  color: string;
  count: number;
}

export interface OrgCompletionStat {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface OrgOverview {
  orgName: string;
  type: string;
  plan: string;
  status: string;
  totalMembers: number;
  activeMembers: number;
  totalCoaches: number;
  engagementRate: number;
  sessionsThisMonth: number;
  avgPhqScore: number | null;
  moodDistribution: OrgMoodRow[];
  engagementSeries: Array<{ label: string; value: number }>;
  completionStats: OrgCompletionStat[];
}

export function useOrgOverview(month?: string) {
  return useQuery({
    queryKey: ["org", "overview", month],
    queryFn: async (): Promise<OrgOverview> => {
      const params = month ? { month } : {};
      const { data } = await api.get("/api/org/overview", { params });
      return data;
    },
  });
}
