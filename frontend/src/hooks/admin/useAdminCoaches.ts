"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AdminCoach } from "@/types/admin";

const adminCoachesKey = ["admin", "coaches"] as const;

export function useAdminCoaches() {
  return useQuery({
    queryKey: adminCoachesKey,
    queryFn: async (): Promise<AdminCoach[]> => {
      const { data } = await api.get("/api/admin/coaches");
      return data;
    },
  });
}

export function useCreateAdminCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      name: string;
      password: string;
      bio?: string;
      speciality?: string;
      avatar?: string;
    }) => {
      const { data } = await api.post("/api/admin/coaches", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCoachesKey });
    },
  });
}

export function useUpdateAdminCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      data: {
        name?: string;
        email?: string;
        bio?: string | null;
        speciality?: string | null;
        avatar?: string | null;
        isActive?: boolean;
      };
    }) => {
      const { data } = await api.put(`/api/admin/coaches/${payload.id}`, payload.data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCoachesKey });
    },
  });
}

export function useRemoveAdminCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/api/admin/coaches/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCoachesKey });
    },
  });
}
