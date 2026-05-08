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
}: {
  title: string;
  children: React.ReactNode;
  topbarRight?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  impersonationBanner?: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role ?? "user";
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Member";

  return (
    <div className="min-h-screen bg-canvas">
      {impersonationBanner}
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <RoleSidebar
            role={role as Role}
            userName={displayName}
            onSwitchRole={() => router.push("/")}
          />
        </div>
        <MobileSidebar
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          role={role as Role}
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
