"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformSettingsService, type PlatformSettings } from "@/services/platformSettings.service";

const QUERY_KEY = ["admin", "platform-settings"] as const;

export function usePlatformSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => platformSettingsService.get(),
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PlatformSettings>) => platformSettingsService.patch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (base64: string) => platformSettingsService.uploadLogo(base64),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUploadLoader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (base64: string) => platformSettingsService.uploadLoader(base64),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

