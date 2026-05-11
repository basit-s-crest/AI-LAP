"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AdminUser } from "@/types/admin";

const adminUsersKey = ["admin", "users"] as const;

export function useAdminUsers() {
  return useQuery({
    queryKey: adminUsersKey,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data } = await api.get("/api/admin/users");
      return data;
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      data: Partial<Pick<AdminUser, "name" | "email" | "role" | "isVerified">>;
    }) => {
      const { data } = await api.put(`/api/admin/users/${payload.id}`, payload.data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/api/admin/users/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersKey });
    },
  });
}
