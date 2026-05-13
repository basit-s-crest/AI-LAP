"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface OrgSettings {
  id: string;
  name: string;
  type: string;
  plan: string;
  primaryContactName: string;
  primaryContactEmail: string;
  status: string;
  notifyWeeklyReport: boolean;
  notifyCrisisAlerts: boolean;
  notifyNewMembers: boolean;
}

export interface UpdateOrgSettingsPayload {
  name?: string;
  type?: string;
  notifyWeeklyReport?: boolean;
  notifyCrisisAlerts?: boolean;
  notifyNewMembers?: boolean;
}

export function useOrgSettings() {
  return useQuery({
    queryKey: ["org", "settings"],
    queryFn: async (): Promise<OrgSettings> => {
      const { data } = await api.get("/api/org/settings");
      return data;
    },
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateOrgSettingsPayload): Promise<OrgSettings> => {
      const { data } = await api.patch("/api/org/settings", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "settings"] });
    },
  });
}
