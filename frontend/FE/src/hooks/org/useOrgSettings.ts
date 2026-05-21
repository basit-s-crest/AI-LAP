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
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["org", "settings"] });
      const previous = queryClient.getQueryData<OrgSettings>(["org", "settings"]);
      if (previous) {
        queryClient.setQueryData<OrgSettings>(["org", "settings"], {
          ...previous,
          ...payload,
        });
      }
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["org", "settings"], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["org", "settings"], data);
    },
  });
}
