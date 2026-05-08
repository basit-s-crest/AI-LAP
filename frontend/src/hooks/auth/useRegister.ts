"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";
import type { RegisterPayload } from "@/types/auth";

export function useRegister() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (session) => {
      // Persist to localStorage (vasl_ keys)
      localStorage.setItem("vasl_token", session.token);
      localStorage.setItem("vasl_user", JSON.stringify(session.user));

      // Sync to Redux + cookies (via authSlice.setSession)
      dispatch(setSession(session));

      // Redirect to OTP verification
      router.push("/verify-otp");
    },
    onError: (error: Error) => {
      return error.message;
    },
  });
}
