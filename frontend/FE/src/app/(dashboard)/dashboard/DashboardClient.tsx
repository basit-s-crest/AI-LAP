"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardRouter } from "@/components/dashboard/DashboardRouter";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Role } from "@/types/role";

export function DashboardClient({
  role,
  displayName,
}: {
  role: Role;
  displayName: string;
}) {
  const title =
    role === "superadmin" ? "Admin Overview"
    : role === "organization" ? "Overview"
    : role === "coach" ? "My Dashboard"
    : "Home";

  const topRight =
    role === "superadmin" ? (
      <div className="flex items-center gap-2">
        <Badge variant="red">1 Alert</Badge>
        <Button variant="ghost" size="sm" type="button">⬒ Export</Button>
      </div>
    ) : role === "organization" ? (
      <div className="flex items-center gap-2">
        <Badge variant="gold">University · Enterprise</Badge>
        <Button variant="ghost" size="sm" type="button">⬒ Export Report</Button>
      </div>
    ) : null;

  return (
    <DashboardLayout title={title} topbarRight={topRight} serverRole={role} serverDisplayName={displayName}>
      <DashboardRouter role={role} />
    </DashboardLayout>
  );
}
