"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";
import type { LoginCredentials, RegisterPayload } from "@/types/auth";
import type { Role } from "@/types/role";

export function useLoginMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (session) => {
      dispatch(setSession(session));
    },
  });
}

export function useRegisterMutation(role: Role = "user") {
  const router = useRouter();
  return useMutation<{ userId: string } | void, Error, RegisterPayload>({
    mutationFn: (payload: RegisterPayload) => {
      if (role === "coach") return authService.registerCoach(payload);
      return authService.register(payload);
    },
    onSuccess: (result) => {
      if (role === "coach") {
        router.push("/login?role=coach&registered=1");
      } else {
        const { userId } = result as { userId: string };
        router.push(`/verify?userId=${userId}`);
      }
    },
  });
}

// Role-switching is a dev/demo convenience — not wired to the real backend
export function useSwitchRoleMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async ({ role }: { role: string; baseEmail?: string }) => {
      // In production this would call an impersonation endpoint
      throw new Error("Role switching is not available in production");
    },
    onError: () => {},
  });
}
