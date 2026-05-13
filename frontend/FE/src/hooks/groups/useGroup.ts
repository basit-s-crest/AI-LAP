"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { GroupDetail } from "@/types/group";

export function useGroup(id: string) {
  return useQuery({
    queryKey: ["group", id],
    queryFn: async (): Promise<GroupDetail> => {
      const { data } = await api.get(`/api/groups/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
