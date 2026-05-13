"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { CommunityGroup } from "@/types/group";

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: async (): Promise<CommunityGroup[]> => {
      const { data } = await api.get("/api/groups");
      return data;
    },
  });
}
