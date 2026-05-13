"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { Role } from "@/types/role";
import { useAppSelector } from "@/hooks/redux";
import { getDefaultPathForRole, pathAllowedForRole, normalizePath } from "@/lib/permissions";

export function useRoleGuard(allowedRoles: Role | Role[], pathname: string) {
  const router = useRouter();
  const { user, token } = useAppSelector((s) => s.auth);
  const roles = useMemo(
    () => (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]),
    [allowedRoles]
  );

  useEffect(() => {
    if (!token || !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(getDefaultPathForRole(user.role));
      return;
    }
    const path = normalizePath(pathname);
    if (!pathAllowedForRole(path, user.role)) {
      router.replace(getDefaultPathForRole(user.role));
    }
  }, [token, user, pathname, router, roles]);
}

export function useCurrentRole(): Role | null {
  return useAppSelector((s) => s.auth.user?.role ?? null);
}
