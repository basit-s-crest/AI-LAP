"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import type { CommunityGroup } from "@/types/group";
import { queryKeys } from "./query-keys";

export function useAdminGroupsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.groups(),
    queryFn: () => adminService.getGroups(),
  });
}

export function useActivityQuery() {
  return useQuery({
    queryKey: queryKeys.admin.activity(),
    queryFn: () => adminService.getActivity(),
  });
}

export function useAppendAdminGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (group: CommunityGroup) => group,
    onSuccess: (newGroup) => {
      queryClient.setQueryData<CommunityGroup[]>(queryKeys.admin.groups(), (prev) => [
        ...(prev ?? []),
        newGroup,
      ]);
    },
  });
}
