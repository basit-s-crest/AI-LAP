import type { Role } from "@/types/role";

/** Pathname without query; normalized without trailing slash */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

const USER_PATHS = [
  "/dashboard",
  "/mood-mapping",
  "/community-groups",
  "/coaching",
  "/empowerment-kit",
  "/resources",
  "/profile",
] as const;

const COACH_PATHS = [
  "/dashboard",
  "/clients",
  "/sessions",
  "/messages",
  "/availability",
  "/notes",
  "/coaching",
  "/settings",
  "/risk-dashboard",
] as const;

const ORGANIZATION_PATHS = [
  "/org/dashboard",
  "/org/members",
  "/org/outcomes",
  "/org/coaches",
  "/org/settings",
] as const;

const SUPERADMIN_PATHS = [
  "/admin/dashboard",
  "/admin/users",
  "/admin/coaches",
  "/admin/groups",
  "/admin/orgs",
  "/admin/settings",
] as const;

const ROLE_PATHS: Record<Role, readonly string[]> = {
  user: USER_PATHS,
  coach: COACH_PATHS,
  organization: ORGANIZATION_PATHS,
  superadmin: SUPERADMIN_PATHS,
};

export function pathAllowedForRole(pathname: string, role: Role | null): boolean {
  if (!role) return false;
  const path = normalizePath(pathname);
  if (role === "superadmin") {
    return path.startsWith("/admin/") || path === "/dashboard";
  }
  if (role === "organization" && path.startsWith("/org/")) return true;
  const allowed = ROLE_PATHS[role];
  return allowed.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

export function getDefaultPathForRole(role: Role): string {
  if (role === "superadmin") return "/admin/dashboard";
  if (role === "organization") return "/org/dashboard";
  return "/dashboard";
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case "user":
      return "Member";
    case "coach":
      return "Coach Portal";
    case "organization":
      return "Client Organization";
    case "superadmin":
      return "Super Admin";
    default:
      return role;
  }
}
