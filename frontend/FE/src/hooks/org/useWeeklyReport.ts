"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { weeklyReportService } from "@/services/weeklyReport.service";

export function useWeeklyReport(week?: string) {
  return useQuery({
    queryKey: ["weeklyReport", week],
    queryFn: () => weeklyReportService.getWeeklyReport(week),
  });
}

export function useAvailableWeeks() {
  return useQuery({
    queryKey: ["weeklyReport", "weeks"],
    queryFn: () => weeklyReportService.getAvailableWeeks(),
  });
}

export function useRegenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (week: string) => weeklyReportService.regenerateReport(week),
    onSuccess: (_, week) => {
      queryClient.invalidateQueries({ queryKey: ["weeklyReport", week] });
      queryClient.invalidateQueries({ queryKey: ["weeklyReport", "weeks"] });
    },
  });
}
