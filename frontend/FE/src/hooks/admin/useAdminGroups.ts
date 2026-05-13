"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AdminGroup } from "@/types/admin";

const adminGroupsKey = ["admin", "groups"] as const;

export function useAdminGroups() {
  return useQuery({
    queryKey: adminGroupsKey,
    queryFn: async (): Promise<AdminGroup[]> => {
      const { data } = await api.get("/api/admin/groups");
      return data;
    },
  });
}

export function useCreateAdminGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      emoji?: string;
      description?: string;
      color?: string;
      tags?: string[];
      mod?: string;
    }) => {
      const { data } = await api.post("/api/admin/groups", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminGroupsKey });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateAdminGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      data: {
        name?: string;
        emoji?: string;
        description?: string | null;
        color?: string;
        tags?: string[];
        mod?: string | null;
        status?: string;
      };
    }) => {
      const { data } = await api.put(`/api/admin/groups/${payload.id}`, payload.data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminGroupsKey });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useArchiveAdminGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/api/admin/groups/${id}/archive`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminGroupsKey });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
