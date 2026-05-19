"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings.service";

export function useCoachProfile() {
  return useQuery({
    queryKey: ["coach", "profile"],
    queryFn: () => settingsService.getCoachProfile(),
  });
}

export function useUpdateCoachProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateCoachProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach", "profile"] });
    },
  });
}

export function useUpdateCoachNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateCoachNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach", "profile"] });
    },
  });
}
