"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

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
}

export function useOrgOverview() {
  return useQuery({
    queryKey: ["org", "overview"],
    queryFn: async (): Promise<OrgOverview> => {
      const { data } = await api.get("/api/org/overview");
      return data;
    },
  });
}
