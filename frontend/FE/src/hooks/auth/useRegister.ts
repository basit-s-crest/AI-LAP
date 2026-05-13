"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import type { RegisterPayload } from "@/types/auth";

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: ({ userId }) => {
      // Pass userId via URL so VerifyScreen knows who to verify
      router.push(`/verify?userId=${userId}`);
    },
  });
}
