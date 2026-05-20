"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasAuthCookies } from "@/lib/authCookies";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";

/**
 * Redirects to /maintenance only for visitors without an active session.
 * Logged-in users on dashboard routes are never interrupted when maintenance is toggled.
 */
export function useMaintenanceRedirect() {
  const router = useRouter();
  const { data: platformSettings } = usePublicPlatformSettings();

  useEffect(() => {
    if (!platformSettings?.maintenanceMode) return;
    if (hasAuthCookies()) return;
    router.replace("/maintenance");
  }, [platformSettings?.maintenanceMode, router]);
}
