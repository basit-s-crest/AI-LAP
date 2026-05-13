"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface OrgCoach {
  id: string;
  name: string;
  email: string;
  speciality: string | null;
  isActive: boolean;
}

export interface AdminOrg {
  id: string;
  name: string;
  type: string;
  plan: string;
  status: string;
  primaryContactName: string;
  primaryContactEmail: string;
  monthlySpend: number;
  totalMembers: number;
  activeMembers: number;
  activeRate: number;
  totalCoaches: number;
  coaches: OrgCoach[];
  createdAt: string;
}

export interface OrgStats {
  totalPartners: number;
  totalMembers: number;
  totalMRR: number;
  totalCoaches: number;
}

export interface CreateOrgPayload {
  name: string;
  type: string;
  plan: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPassword: string;
  monthlySpend?: number;
  domain?: string;
  coachIds?: string[];
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: async (): Promise<AdminOrg[]> => {
      const { data } = await api.get("/api/admin/orgs");
      return data;
    },
  });
}

export function useAdminOrgStats() {
  return useQuery({
    queryKey: ["admin", "orgs", "stats"],
    queryFn: async (): Promise<OrgStats> => {
      const { data } = await api.get("/api/admin/orgs/stats");
      return data;
    },
  });
}

export function useAdminAllCoaches() {
  return useQuery({
    queryKey: ["admin", "coaches"],
    queryFn: async (): Promise<OrgCoach[]> => {
      const { data } = await api.get("/api/admin/coaches");
      return data;
    },
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrgPayload) => {
      const { data } = await api.post("/api/admin/orgs", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
      qc.invalidateQueries({ queryKey: ["admin", "orgs", "stats"] });
    },
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<AdminOrg> & { id: string; coachIds?: string[] }) => {
      const { data } = await api.put(`/api/admin/orgs/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orgs"] });
      qc.invalidateQueries({ queryKey: ["admin", "orgs", "stats"] });
    },
  });
}
