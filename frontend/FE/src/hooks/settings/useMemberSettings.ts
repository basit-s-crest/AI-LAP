"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings.service";

export function useMemberProfile() {
  return useQuery({
    queryKey: ["member", "profile"],
    queryFn: () => settingsService.getMemberProfile(),
  });
}

export function useUpdateMemberProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateMemberProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", "profile"] });
    },
  });
}

export function useUpdateMemberNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateMemberNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", "profile"] });
    },
  });
}

export function useMemberConsent() {
  return useQuery({
    queryKey: ["member", "consent"],
    queryFn: () => settingsService.getMemberConsent(),
  });
}

export function useUpdateMemberConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateMemberConsent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", "consent"] });
    },
  });
}

