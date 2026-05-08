"use client";

import type { Role } from "@/types/role";
import { UserDashboard } from "./UserDashboard";
import { CoachDashboardHome } from "./CoachDashboardHome";
import { OrgDashboardHome } from "./OrgDashboardHome";
import { SuperadminDashboardHome } from "./SuperadminDashboardHome";

export function DashboardRouter({ role }: { role: Role }) {
  switch (role) {
    case "user":
      return <UserDashboard />;
    case "coach":
      return <CoachDashboardHome />;
    case "organization":
      return <OrgDashboardHome />;
    case "superadmin":
      return <SuperadminDashboardHome />;
    default:
      return <UserDashboard />;
  }
}
