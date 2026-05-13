"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coachService } from "@/services/coach.service";
import type { CoachPublicDTO } from "@/types/coach";
import { queryKeys } from "./query-keys";

export function useCoachesQuery() {
  return useQuery<CoachPublicDTO[]>({
    queryKey: queryKeys.coaches.list(),
    queryFn: () => coachService.list(),
  });
}

export function useCoachQuery(coachId: string, enabled = true) {
  return useQuery<CoachPublicDTO | undefined>({
    queryKey: queryKeys.coaches.detail(coachId as unknown as number),
    queryFn: async () => {
      const coaches = await coachService.list();
      return coaches.find((c) => c.id === coachId);
    },
    enabled: enabled && !!coachId,
  });
}

export function useAppendCoachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (coach: CoachPublicDTO) => coach,
    onSuccess: (newCoach) => {
      queryClient.setQueryData<CoachPublicDTO[]>(queryKeys.coaches.list(), (prev) => [
        ...(prev ?? []),
        newCoach,
      ]);
    },
  });
}

export function useRemoveCoachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => id,
    onSuccess: (removedId) => {
      queryClient.setQueryData<CoachPublicDTO[]>(queryKeys.coaches.list(), (prev) =>
        (prev ?? []).filter((c) => c.id !== removedId)
      );
    },
  });
}
