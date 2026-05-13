"use client";

import { useMutation } from "@tanstack/react-query";
import { useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";
import type { LoginCredentials } from "@/types/auth";
import type { Role } from "@/types/role";

export function getDashboardRoute(role: Role): string {
  switch (role) {
    case "coach":        return "/dashboard";
    case "user":         return "/dashboard";
    case "organization": return "/org/dashboard";
    case "superadmin":   return "/admin/dashboard";
    default:             return "/dashboard";
  }
}

export function useLogin(role: Role = "user") {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => {
      // Coach login hits a separate backend endpoint
      if (role === "coach") return authService.loginCoach(credentials);
      if (role === "organization") return authService.orgLogin(credentials);
      return authService.login(credentials);
    },
    onSuccess: (session) => {
      dispatch(setSession(session));
      // Full navigation so browser sends fresh cookies to Next.js middleware
      window.location.href = getDashboardRoute(session.user.role);
    },
  });
}
