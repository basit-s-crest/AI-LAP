"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface OrgOutcomes {
  phqImprovement: number | null;
  gadImprovement: number | null;
  retentionRate: number;
  phqDistribution: Array<{
    label: string;
    color: string;
    percent: number;
    count: number;
  }>;
  keyMetrics: {
    membersWith3PlusSessions: number;
    avgSessionsPerMember: number;
    coachSatisfactionRating: number | null;
    crisisEscalations: number;
    membersInGroup: number;
  };
}

export function useOrgOutcomes() {
  return useQuery({
    queryKey: ["org", "outcomes"],
    queryFn: async (): Promise<OrgOutcomes> => {
      const { data } = await api.get("/api/org/outcomes");
      return data;
    },
  });
}
