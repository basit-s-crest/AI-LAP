"use client";

import { useQuery } from "@tanstack/react-query";
import { organizationService } from "@/services/organization.service";
import { queryKeys } from "./query-keys";

export function useOrganizationsQuery() {
  return useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: () => organizationService.list(),
  });
}

export function useOrganizationQuery(id: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(id),
    queryFn: () => organizationService.getById(id),
    enabled: enabled && Number.isFinite(id) && id > 0,
  });
}
