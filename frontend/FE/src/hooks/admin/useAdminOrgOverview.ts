"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { OrgOverview } from "@/hooks/org/useOrgOverview";

export function useAdminOrgOverview(orgId: string) {
  return useQuery({
    queryKey: ["admin", "orgs", orgId, "overview"],
    queryFn: async (): Promise<OrgOverview> => {
      const { data } = await api.get(`/api/admin/orgs/${orgId}/overview`);
      return data;
    },
    enabled: !!orgId,
  });
}
