"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoleSidebar } from "./RoleSidebar";
import { Topbar } from "./Topbar";
import { MobileSidebar } from "./MobileSidebar";
import type { Role } from "@/types/role";
import { useAppSelector, useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { setSidebarMinimized } from "@/store/slices/uiSlice";
import { cn } from "@/lib/cn";
import api from "@/lib/api";

export function DashboardLayout({
  title,
  children,
  topbarRight,
  breadcrumbs,
  impersonationBanner,
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
  const dispatch = useAppDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);

  const reduxUser = useAppSelector((s) => s.auth.user);
  const reduxToken = useAppSelector((s) => s.auth.token);
  const role: Role = reduxUser?.role ?? serverRole;
  const displayName = reduxUser
    ? `${reduxUser.firstName} ${reduxUser.lastName}`.trim() || serverDisplayName
    : serverDisplayName;

  const sidebarMinimized = useAppSelector((s) => s.ui.sidebarMinimized);

  // Sync name from DB on mount so admin name changes reflect immediately
  useEffect(() => {
    if (!reduxUser || !reduxToken) return;
    // Only sync for members — coaches/admins have their own profile endpoints
    if (reduxUser.role !== "user") return;

    api.get<{ firstName: string; lastName: string; avatar: string | null }>(
      "/api/auth/profile"
    ).then((res) => {
      const { firstName, lastName, avatar } = res.data;
      // Only update if name actually changed
      if (
        firstName !== reduxUser.firstName ||
        lastName !== reduxUser.lastName
      ) {
        dispatch(
          setSession({
            token: reduxToken,
            user: {
              ...reduxUser,
              firstName,
              lastName,
              avatarEmoji: avatar ?? reduxUser.avatarEmoji,
            },
            expiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
        );
      }
    }).catch(() => {
      // silently ignore — sidebar will just show cached name
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // Hydrate sidebar minimized state from localStorage on client
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-minimized");
    if (stored === "true") {
      dispatch(setSidebarMinimized(true));
    }
  }, [dispatch]);

  return (
    <div className={cn("min-h-screen bg-canvas", sidebarMinimized && "sidebar-minimized")}>
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