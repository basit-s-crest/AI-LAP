"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_AUTH_ROLE,
  getAuthRoleOption,
  parseAuthRole,
  type AuthRoleOption,
} from "@/lib/auth-roles";
import type { Role } from "@/types/role";

/**
 * Reads ?role= from the URL after mount to avoid SSR/client searchParams mismatch (hydration errors).
 */
export function useAuthRoleParam(initialRole?: Role): {
  role: Role;
  roleOption: AuthRoleOption;
  ready: boolean;
} {
  const search = useSearchParams();
  const [role, setRole] = useState<Role>(initialRole ?? DEFAULT_AUTH_ROLE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(parseAuthRole(search.get("role")));
    setReady(true);
  }, [search]);

  return { role, roleOption: getAuthRoleOption(role), ready };
}
