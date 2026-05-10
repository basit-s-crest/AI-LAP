"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

interface UseAssignCoachOptions {
  onError?: (error: Error) => void;
}

export function useAssignCoach(options?: UseAssignCoachOptions) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async (coachId: string) => {
      const response = await api.post<{ assigned: boolean; coachId: string; assignedAt: string }>(
        "/api/coach/assign",
        { coachId }
      );
      return response.data;
    },
    onSuccess: (data) => {
      router.push(`/coaching/${data.coachId}`);
    },
    onError: (error: Error) => {
      if (options?.onError) {
        options.onError(error);
      } else {
        // axios wraps the response — try to surface the backend message
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (error as any)?.response?.data?.message ?? error.message ?? "Could not connect to coach. Please try again.";
        if (msg.includes("not found") || msg.includes("log out")) {
          toast.error("Session expired. Please log out and log back in.");
        } else {
          toast.error(msg);
        }
      }
    },
  });

  return {
    assignAndNavigate: (coachId: string) => mutation.mutate(coachId),
    isPending: mutation.isPending,
    pendingCoachId: mutation.isPending ? (mutation.variables as string | undefined) : undefined,
  };
}
