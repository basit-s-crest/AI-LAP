"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coachService } from "@/services/coach.service";
import type { Coach } from "@/types/coach";
import { queryKeys } from "./query-keys";

export function useCoachesQuery() {
  return useQuery({
    queryKey: queryKeys.coaches.list(),
    queryFn: () => coachService.list(),
  });
}

export function useCoachQuery(id: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.coaches.detail(id),
    queryFn: () => coachService.getById(id),
    enabled: enabled && Number.isFinite(id) && id > 0,
  });
}

export function useAppendCoachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (coach: Coach) => coach,
    onSuccess: (newCoach) => {
      queryClient.setQueryData<Coach[]>(queryKeys.coaches.list(), (prev) => [...(prev ?? []), newCoach]);
    },
  });
}

export function useRemoveCoachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => id,
    onSuccess: (removedId) => {
      queryClient.setQueryData<Coach[]>(queryKeys.coaches.list(), (prev) =>
        (prev ?? []).filter((c) => c.id !== removedId)
      );
    },
  });
}
