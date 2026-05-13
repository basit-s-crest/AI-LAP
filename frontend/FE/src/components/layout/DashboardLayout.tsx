"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RoleSidebar } from "./RoleSidebar";
import { Topbar } from "./Topbar";
import { MobileSidebar } from "./MobileSidebar";
import type { Role } from "@/types/role";
import { useAppSelector } from "@/hooks/redux";
import { cn } from "@/lib/cn";

export function DashboardLayout({
  title,
  children,
  topbarRight,
  breadcrumbs,
  impersonationBanner,
  // Server-read values passed as props — correct on first render, no hydration mismatch
  serverRole = "user",
  serverDisplayName = "Member",
}: {
  title: string;
  children: React.ReactNode;
  topbarRight?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  impersonationBanner?: React.ReactNode;
  serverRole?: Role;
  serverDisplayName?: string;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Redux hydrates after first render via AuthHydrator.
  // Use server-passed values as fallback — they're already correct so no flash.
  const reduxUser = useAppSelector((s) => s.auth.user);
  const role: Role = reduxUser?.role ?? serverRole;
  const displayName = reduxUser
    ? `${reduxUser.firstName} ${reduxUser.lastName}`.trim() || serverDisplayName
    : serverDisplayName;

  return (
    <div className="min-h-screen bg-canvas">
      {impersonationBanner}
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <RoleSidebar
            role={role}
            userName={displayName}
            onSwitchRole={() => router.push("/")}
          />
        </div>
        <MobileSidebar
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          role={role}
          userName={displayName}
        />
        <div className={cn("flex min-h-screen flex-1 flex-col")}>
          <Topbar
            title={title}
            breadcrumbs={breadcrumbs}
            right={topbarRight}
            onMenu={() => setMobileOpen(true)}
          />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
