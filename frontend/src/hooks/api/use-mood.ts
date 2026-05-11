"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { moodService, MoodValue } from "@/services/mood.service";

export function useSubmitMood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mood: MoodValue) => moodService.submitMood(mood),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mood-trend"] });
      queryClient.invalidateQueries({ queryKey: ["mood-all-trends"] });
    },
  });
}

export function useMoodTrend(days: 7 | 30 | 60) {
  return useQuery({
    queryKey: ["mood-trend", days],
    queryFn: () => moodService.getMoodTrend(days),
    staleTime: 30_000,
  });
}

export function useAllMoodTrends() {
  return useQuery({
    queryKey: ["mood-all-trends"],
    queryFn: () => moodService.getAllTrends(),
    staleTime: 30_000,
  });
}