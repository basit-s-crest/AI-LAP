"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface OrgCoach {
  id: string;
  name: string;
  email: string;
  speciality: string | null;
  bio: string | null;
  isActive: boolean;
  avatar: string | null;
  createdAt: string;
}

export function useOrgCoaches() {
  return useQuery({
    queryKey: ["org", "coaches"],
    queryFn: async (): Promise<OrgCoach[]> => {
      const { data } = await api.get("/api/org/coaches");
      return data;
    },
  });
}
