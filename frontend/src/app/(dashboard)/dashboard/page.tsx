"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardRouter } from "@/components/dashboard/DashboardRouter";
import { useAppSelector } from "@/hooks/redux";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Mail, Bell } from "lucide-react";

export default function DashboardPage() {
  const role = useAppSelector((s) => s.auth.user?.role ?? "user");

  const title =
    role === "superadmin"
      ? "Admin Overview"
      : role === "organization"
        ? "Overview"
        : role === "coach"
          ? "My Dashboard"
          : "Home";

  const topRight =
    role === "superadmin" ? (
      <div className="flex items-center gap-2">
        <Badge variant="red">1 Alert</Badge>
        <Button variant="ghost" size="sm" type="button">
          ⬒ Export
        </Button>
      </div>
    ) : role === "organization" ? (
      <div className="flex items-center gap-2">
        <Badge variant="gold">University · Enterprise</Badge>
        <Button variant="ghost" size="sm" type="button">
          ⬒ Export Report
        </Button>
      </div>
    ) : role === "coach" ? (
      <div className="flex items-center gap-2">
        <Badge variant="red">2 Messages</Badge>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Button variant="ghost" size="sm" type="button" aria-label="Messages">
            <Mail className="h-4 w-4" />
          </Button>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-card bg-terra" />
        </div>
        <div className="relative">
          <Button variant="ghost" size="sm" type="button" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-card bg-terra" />
        </div>
      </div>
    );

  return (
    <DashboardLayout title={title} topbarRight={topRight}>
      <DashboardRouter role={role} />
    </DashboardLayout>
  );
}
