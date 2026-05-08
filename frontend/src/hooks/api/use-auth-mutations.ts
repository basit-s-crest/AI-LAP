"use client";

import { useMutation } from "@tanstack/react-query";
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

export function useRegisterMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (session) => {
      dispatch(setSession(session));
    },
  });
}

export function useSwitchRoleMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: ({ role, baseEmail }: { role: Role; baseEmail?: string }) =>
      authService.switchRole(role, baseEmail),
    onSuccess: (session) => {
      dispatch(setSession(session));
    },
  });
}
