// Server Component — reads cookies on the server, no hydration mismatch
import { cookies } from "next/headers";
import { AUTH_ROLE_KEY, AUTH_USER_JSON_KEY } from "@/constants/storage";
import type { Role } from "@/types/role";
import type { AuthUser } from "@/types/auth";
import { DashboardClient } from "../../dashboard/DashboardClient";

function parseRole(value: string | undefined): Role {
  const valid: Role[] = ["user", "coach", "organization", "superadmin"];
  return valid.includes(value as Role) ? (value as Role) : "user";
}

export default async function AdminDashboardPage() {
  const jar = await cookies();
  const role = parseRole(jar.get(AUTH_ROLE_KEY)?.value);

  let displayName = "Member";
  const raw = jar.get(AUTH_USER_JSON_KEY)?.value;
  if (raw) {
    try {
      const u = JSON.parse(raw) as AuthUser;
      displayName = `${u.firstName} ${u.lastName}`.trim() || "Member";
    } catch {
      // ignore malformed cookie
    }
  }

  return <DashboardClient role={role} displayName={displayName} />;
}
